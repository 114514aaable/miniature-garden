// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 调试台 / 启动器（宿主侧）。
 *
 * 分工：
 *   服务端：读包、加载世界、求值规则、生成绘制指令
 *   页面：  只负责画（Canvas + DOM），不碰世界
 *
 * 启动方式：
 *   node tools/serve.mjs                     # 启动器：列出 worlds/ 下的世界
 *   node tools/serve.mjs worlds/a worlds/b   # 直接进某个世界（开发用）
 */

import { createServer } from "node:http";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { readPack } from "./pack-reader.mjs";
import { GAME_PAGE, LAUNCHER_PAGE } from "./pages.mjs";
import { loadWorld } from "../engine/core/src/pack/load.ts";
import { mergePacks } from "../engine/core/src/pack/merge.ts";
import { orderPacks } from "../engine/core/src/pack/order.ts";
import { evaluate } from "../engine/core/src/event/evaluate.ts";
import { collectEffects } from "../engine/core/src/event/effects.ts";
import { Registry } from "../engine/core/src/event/registry.ts";
import { createWorldView } from "../engine/core/src/event/view.ts";
import { Store } from "../engine/core/src/store.ts";
import { costOf, DEFAULT_CLOCK } from "../engine/core/src/rules/clock.ts";
import { moveHandler, moveSignature } from "../engine/core/src/rules/move.ts";
import { dropHandler, dropSignature, takeHandler, takeSignature } from "../engine/core/src/rules/inventory.ts";
import { attackHandler, attackSignature } from "../engine/core/src/rules/attack.ts";
import { enemyTurnHandler, enemyTurnSignature } from "../engine/core/src/rules/ai.ts";
import { waitHandler, waitSignature } from "../engine/core/src/rules/wait.ts";
import { aimHandler, aimSignature } from "../engine/core/src/rules/aim.ts";
import {
  strikeHandler,
  strikeSignature,
  windupHandler,
  windupSignature,
} from "../engine/core/src/rules/enemy-actions.ts";
import { Scheduler } from "../engine/core/src/rules/scheduler.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { createProjector } from "../systems/render/project.ts";
import { buildGraph } from "../engine/core/src/pack/graph.ts";
import { DevLog, formatLine } from "../systems/log/devlog.ts";

const LOCALE = "zh-CN";
let MESSAGES = {};
try {
  MESSAGES = JSON.parse(readFileSync(`locales/${LOCALE}.json`, "utf8"));
} catch {
  console.warn("没有找到语言包，界面会显示 key");
}

/** 把页面里的 {{key}} 换成译文；查不到就保留原样（能一眼看出漏了）。 */
function renderPage(html) {
  return html.replace(/\{\{([\w.-]+)\}\}/g, (whole, key) =>
    typeof MESSAGES[key] === "string" ? MESSAGES[key] : whole,
  );
}

const PORT = Number(process.env.PORT ?? 8787);
const WORLDS_DIR = "worlds";
const TILE = 40;
const VIEWPORT = { width: 320, height: 240 };

const DIRECTIONS = {
  w: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
};

// ── 世界发现 ──────────────────────────────────────────────

/** 读 worlds/ 下所有包；坏的包记成错误，不影响别的。 */
function collectPacks() {
  const contents = [];
  const errors = [];

  let names = [];
  try {
    names = readdirSync(WORLDS_DIR);
  } catch (error) {
    errors.push({ id: WORLDS_DIR, error: messageOf(error) });
  }

  for (const name of names) {
    const dir = join(WORLDS_DIR, name);
    if (!statSync(dir).isDirectory()) continue;
    try {
      contents.push(readPack(dir));
    } catch (error) {
      errors.push({ id: name, error: messageOf(error) });
    }
  }

  return { contents, byId: new Map(contents.map((content) => [content.pack.id, content])), errors };
}

/** 从某个包出发，把它的依赖闭包按加载顺序排好。 */
function closureOf(rootId, byId) {
  const ordered = [];
  const seen = new Set();

  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    const content = byId.get(id);
    if (content === undefined) {
      throw new Error(`缺少依赖：${id}`);
    }
    for (const dependency of Object.keys(content.pack.requires ?? {})) {
      visit(dependency);
    }
    ordered.push(content);
  };

  visit(rootId);
  return orderPacks(ordered.map((content) => content.pack)).map((pack) => byId.get(pack.id));
}

/** 列世界：只列「根包」——没有被别的包依赖的那些。 */
function scanWorlds() {
  const { contents, byId, errors } = collectPacks();

  const required = new Set();
  for (const content of contents) {
    for (const dependency of Object.keys(content.pack.requires ?? {})) {
      required.add(dependency);
    }
  }

  const roots = contents.filter((content) => !required.has(content.pack.id));
  const worlds = roots.map((root) => {
    try {
      const ordered = closureOf(root.pack.id, byId);
      loadWorld(mergePacks(ordered));
      return {
        id: root.pack.id,
        version: root.pack.version,
        packs: ordered.map((content) => `${content.pack.id}@${content.pack.version}`),
        ok: true,
      };
    } catch (error) {
      return { id: root.pack.id, version: root.pack.version, ok: false, error: messageOf(error) };
    }
  });

  return { worlds, errors };
}

// ── 会话：一个正在运行的世界 ──────────────────────────────

let session = null;

/** 规则表：签名 + 处理器。关掉一条规则就是把它从这里跳过。 */
const RULE_TABLE = [
  { signature: moveSignature, handler: moveHandler },
  { signature: takeSignature, handler: takeHandler },
  { signature: dropSignature, handler: dropHandler },
  { signature: attackSignature, handler: attackHandler },
  { signature: enemyTurnSignature, handler: enemyTurnHandler },
  { signature: windupSignature, handler: windupHandler },
  { signature: strikeSignature, handler: strikeHandler },
  { signature: waitSignature, handler: waitHandler },
  { signature: aimSignature, handler: aimHandler },
];

function buildSession(ordered, disabled = new Set()) {
  const merged = mergePacks(ordered);
  const loaded = loadWorld(merged);

  const store = new Store(loaded.spaces, { templates: loaded.templates });
  for (const entity of loaded.entities) {
    store.submit({
      kind: "spawn",
      space: entity.space,
      cell: entity.pos,
      template: entity.template,
      overrides: entity.overrides,
    });
  }
  const spawnEvents = store.step();

  let playerHandle = null;
  for (const entry of spawnEvents) {
    const handle = entry.data.handle;
    if (store.entity(handle).template === "pc") {
      playerHandle = handle;
    }
  }

  const registry = new Registry();
  const active = RULE_TABLE.filter((rule) => !disabled.has(rule.signature.tag));
  for (const rule of active) {
    registry.define(rule.signature);
  }
  const link = registry.link();

  const handlers = new Map(active.map((rule) => [link.tags.get(rule.signature.tag), rule.handler]));

  const skills = link.signatures
    .filter((signature) => signature.skill !== undefined)
    .map((signature) => ({ tag: signature.tag, ...signature.skill }));

  const projector = createProjector(
    {
      id: "render.canvas2d",
      version: "0.1.0",
      needs: {
        spaces: "current",
        camera: true,
        entityFields: ["pos", "template"],
        components: [
          { name: "core.health", required: false },
          { name: "core.container", required: false },
        ],
        ui: ["inventory", "skills", "messages"],
      },
    },
    loaded.templates,
  );
  for (const warning of projector.warnings) {
    console.warn(`[render] ${warning}`);
  }

  // 有 core.ai 的非玩家实体进调度器。
  const scheduler = new Scheduler([], store.now());
  const startView = createWorldView(loaded.spaces, {
    tick: store.now(),
    entities: { get: (handle) => store.entity(handle) },
    terrains: loaded.terrains,
    templates: loaded.templates,
  });
  for (const entity of store.allEntities()) {
    if (entity.handle === playerHandle) continue;
    if (startView.entity(entity.handle).components["core.ai"] !== undefined) {
      scheduler.add(entity.handle, store.now());
    }
  }

  return {
    loaded,
    store,
    link,
    handlers,
    skills,
    projector,
    playerHandle,
    scheduler,
    playerReadyAt: store.now(),
    packs: ordered.map((content) => `${content.pack.id}@${content.pack.version}`),
    lastEvents: [],
    devlog: new DevLog(),
  };
}

// ── 快照 ────────────────────────────────────────────────

function currentView() {
  return createWorldView(session.loaded.spaces, {
    tick: session.store.now(),
    entities: { get: (handle) => session.store.entity(handle) },
    terrains: session.loaded.terrains,
    templates: session.loaded.templates,
  });
}

function playerHud() {
  if (session.playerHandle === null) {
    return { hp: 0, hpMax: 0, inventory: [], readyAt: 0, tick: 0 };
  }
  const components = currentView().entity(session.playerHandle).components;

  const health = components["core.health"];
  const container = components["core.container"];

  return {
    hp: readNumber(health, "hp", readNumber(health, "max", 0)),
    hpMax: readNumber(health, "max", 0),
    inventory: readNumberArray(container, "items"),
    readyAt: session.playerReadyAt,
    tick: session.store.now(),
  };
}

function readNumber(component, key, fallback) {
  if (typeof component !== "object" || component === null || Array.isArray(component)) return fallback;
  const value = component[key];
  return typeof value === "number" ? value : fallback;
}

function readNumberArray(component, key) {
  if (typeof component !== "object" || component === null || Array.isArray(component)) return [];
  const value = component[key];
  return Array.isArray(value) ? value.filter((item) => typeof item === "number") : [];
}

function snapshot(message) {
  const frame = session.projector.snapshot({
    tick: session.store.now(),
    spaces: session.loaded.spaces,
    templates: session.loaded.templates,
    entities: session.store.allEntities(),
  });

  return {
    launcher: false,
    tile: TILE,
    playerHandle: session.playerHandle,
    snapshot: {
      tick: frame.tick,
      // 地形转成普通数组：JSON 里 Int32Array 会变成奇怪的对象
      spaces: frame.spaces.map((space) => ({
        id: space.id,
        width: space.width,
        height: space.height,
        terrain: Array.from(space.terrain),
      })),
      entities: frame.entities,
    },
    hud: playerHud(),
    tick: session.store.now(),
    hash: session.store.headHash,
    message,
    rules: session.loaded.rules,
    packs: session.packs,
    worldHash: session.loaded.hash,
    skills: session.skills.map((skill) => ({
      tag: skill.tag,
      name: skill.name,
      cost: skill.cost,
      target: skill.target.kind,
    })),
    events: session.lastEvents.map((entry) => `#${entry.id} ${entry.kind} ${JSON.stringify(entry.data)}`),
    devlog: session.devlog.tail(200).map(formatLine),
    debug: {
      tick: session.store.now(),
      playerReadyAt: session.playerReadyAt,
      upcoming: session.scheduler.upcoming(5),
      actors: (() => {
        const view = currentView();
        return [...session.scheduler.upcoming(64)].map((due) => {
          const entity = session.store.entity(due.handle);
          const intent = view.entity(due.handle).components["core.intent"];
          return {
            handle: due.handle,
            template: entity.template,
            readyAt: due.tick,
            x: entity.pos === null ? null : entity.pos.x,
            y: entity.pos === null ? null : entity.pos.y,
            intent: summarizeIntent(intent, entity),
          };
        });
      })(),
    },
  };
}

/** 把意图翻译成「打哪几格、什么时候」。没有意图返回 null。 */
function summarizeIntent(intent, entity) {
  if (typeof intent !== "object" || intent === null || Array.isArray(intent)) return null;
  const tiles = Array.isArray(intent.tiles) ? intent.tiles : [];
  if (tiles.length === 0 || entity.pos === null) return null;

  return {
    resolveAt: intent.resolveAt ?? 0,
    damage: intent.damage ?? 0,
    tiles: tiles.map((tile) => ({
      x: entity.pos.x + (tile.dx ?? 0),
      y: entity.pos.y + (tile.dy ?? 0),
    })),
  };
}

// ── 动作 ────────────────────────────────────────────────

function act(command) {
  if (session.playerHandle === null) {
    return snapshot("这个世界没有玩家角色");
  }

  const direction = DIRECTIONS[command];
  if (direction !== undefined) {
    const position = session.store.entity(session.playerHandle).pos;
    return run(
      "core.move",
      {
        handle: session.playerHandle,
        space: session.store.entity(session.playerHandle).space,
        x: position.x + direction.dx,
        y: position.y + direction.dy,
      },
      "move",
    );
  }

  if (command === "e") {
    return run("core.take", { actor: session.playerHandle }, "take");
  }

  if (command === "r") {
    const position = session.store.entity(session.playerHandle).pos;
    return run(
      "core.drop",
      { actor: session.playerHandle, x: position.x, y: position.y },
      "drop",
    );
  }

  return snapshot("不懂这个指令（w/a/s/d 走，e 捡，r 放）");
}
/** 看：这一格有什么。地形 + 站在上面的东西。 */
function inspectCell(x, y) {
  if (session === null) return { ok: false, error: "没有进行中的世界" };

  const view = currentView();
  const player = session.playerHandle === null ? null : session.store.entity(session.playerHandle);
  const spaceId = player && player.space !== null ? player.space : session.loaded.spaces[0].id;
  const space = view.space(spaceId);

  if (x < 0 || y < 0 || x >= space.width || y >= space.height) {
    return { ok: false, error: "那里没有格子" };
  }

  const terrain = space.terrainAt({ x, y });
  const entities = space
    .occupantsAt({ x, y })
    .map((handle) => {
      const entity = view.entity(handle);
      const health = entity.components["core.health"];
      const intent = entity.components["core.intent"];
      return {
        handle,
        template: entity.template,
        name: MESSAGES["template." + entity.template + ".name"] ?? entity.template,
        description: MESSAGES["template." + entity.template + ".desc"] ?? "",
        hp: health ? { cur: health.hp ?? health.max, max: health.max } : null,
        intent: intent && Array.isArray(intent.tiles) && intent.tiles.length > 0
          ? { damage: intent.damage, resolveAt: intent.resolveAt, count: intent.tiles.length }
          : null,
      };
    });

  return {
    ok: true,
    cell: { x, y },
    terrain: {
      id: terrain,
      name: MESSAGES["terrain." + terrain + ".name"] ?? "地形 " + terrain,
    },
    entities,
  };
}

/** 问：这个技能能不能落在这一格。 */
function aimAt(tag, x, y) {
  const sym = session.link.tags.get(tag);
  const signature = sym === undefined ? undefined : session.link.signatures[sym];
  if (signature === undefined || signature.skill === undefined) {
    return { ok: false, cells: [], reason: "没有这个技能" };
  }
  if (signature.skill.target.kind === "self") {
    return { ok: false, cells: [], reason: "这个技能不需要目标" };
  }

  const kind = signature.skill.target.kind === "entity" ? "entity" : "cell";
  const result = evaluate(
    {
      id: session.store.now() + 1,
      tag: "core.aim",
      params: { actor: session.playerHandle, kind, range: signature.skill.target.range, x, y },
    },
    session.link,
    session.handlers,
    currentView(),
  );

  if (!result.ok || !result.value) {
    return { ok: false, cells: [], reason: "指向失败" };
  }
  return result.value;
}

function useSkill(tag, x, y) {
  const sym = session.link.tags.get(tag);
  const signature = sym === undefined ? undefined : session.link.signatures[sym];
  if (signature === undefined || signature.skill === undefined) {
    return snapshot("没有这个技能");
  }

  if (signature.skill.target.kind === "self") {
    return run(tag, { actor: session.playerHandle }, signature.skill.cost);
  }

  if (x === undefined || y === undefined) {
    return snapshot(`${signature.skill.name} 需要先指出目标格`);
  }

  return run(tag, { actor: session.playerHandle, x, y }, signature.skill.cost);
}

function adjacentTarget() {
  const self = session.store.entity(session.playerHandle);
  if (self.pos === null || self.space === null) return null;

  const view = currentView();
  const space = view.space(self.space);

  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const cell = { x: self.pos.x + dx, y: self.pos.y + dy };
    if (!space.passableAt(cell)) continue;
    for (const handle of space.occupantsAt(cell)) {
      if (handle === session.playerHandle) continue;
      if (view.entity(handle).components["core.health"] !== undefined) {
        return handle;
      }
    }
  }
  return null;
}

function run(tag, params, costKey) {
  const envelope = { id: session.store.now() + 1, tag, params };
  session.devlog.action(session.store.now(), tag, params);

  const result = evaluate(envelope, session.link, session.handlers, currentView());
  if (!result.ok) {
    session.devlog.action(session.store.now(), `${tag} 求值失败`, {
      message: result.diagnostics[0]?.message ?? "未知",
    });
    return snapshot(`规则出错：${result.diagnostics[0]?.message ?? "未知"}`);
  }

  const value = result.value;
  if (value.ok !== true) {
    session.devlog.action(session.store.now(), `${tag} 被拒绝`, { reason: value.reason ?? null });
    return snapshot(value.reason ?? "不行");
  }

  const effects = collectEffects(result.value);
  for (const effect of effects) {
    session.store.submit(effect);
  }

  // 动作生效，然后世界推进到玩家下次能行动为止（敌人会在这段里行动）。
  // 注意：成本不看「有没有效果」——等待就是不产生效果但照样花时间。
  const cost = costOf(DEFAULT_CLOCK, costKey, speedOfPlayer());
  session.playerReadyAt = session.store.now() + cost;
  session.lastEvents = [];
  advanceTo(session.playerReadyAt);

  const rounds = cost === 0 ? "（零帧）" : `（${cost} 回合）`;
  return snapshot(`${skillName(tag)}${rounds}`);
}

/**
 * 逐 tick 推进世界。
 *
 * 玩家用一次 cost 表示动作占多少回合，但敌人是逐 tick 结算的，
 * 所以不能 step(cost) 一次跳完——中间要给敌人行动的机会。
 */
function advanceTo(target) {
  let guard = 0;
  while (session.store.now() < target) {
    if (guard++ > 512) {
      session.devlog.action(session.store.now(), "调度器", { error: "推进次数超限" });
      break;
    }
    const events = session.store.step(1);
    for (const entry of events) {
      session.lastEvents.push(entry);
      session.devlog.effect(entry);
    }
    // 被打死的敌人要从调度器里清掉，否则会和它的句柄一起留在队列里
    session.scheduler.prune((handle) => session.store.hasEntity(handle));
    drainEnemies();
  }
  applyPending();
}

/** 让当前 tick 该行动的敌人行动（可能连续多个）。 */
function drainEnemies() {
  const now = session.store.now();
  let guard = 0;
  for (;;) {
    const due = session.scheduler.peek();
    if (due === null || due.tick > now) break;
    if (guard++ > 64) break;

    session.scheduler.take();
    enemyAct(due.handle);
  }
}

/** 敌人的一回合：问 AI 想做什么，再用同一套求值跑它产出的信封。 */
function enemyAct(handle) {
  const view = currentView();
  const ask = evaluate(
    { id: session.store.now() + 1, tag: "core.enemy_turn", params: { enemy: handle, target: session.playerHandle } },
    session.link,
    session.handlers,
    view,
  );

  const next = ask.ok && ask.value && ask.value.next ? ask.value.next : null;
  if (next === null) {
    session.devlog.action(session.store.now(), `敌人 ${handle} 等待`, {});
    session.scheduler.done(handle, 1);
    return;
  }

  session.devlog.action(session.store.now(), `敌人 ${handle} → ${next.tag}`, next.params);

  const result = evaluate(
    { id: session.store.now() + 2, tag: next.tag, params: next.params },
    session.link,
    session.handlers,
    view,
  );
  if (result.ok && result.value && result.value.ok === true) {
    for (const effect of collectEffects(result.value)) {
      session.store.submit(effect);
    }
  } else {
    session.devlog.action(session.store.now(), `敌人 ${handle} 动不了`, {
      reason: (result.ok && result.value && result.value.reason) || "求值失败",
    });
  }

  const key = next.tag === "core.attack" ? "attack" : "move";
  session.scheduler.done(handle, costOf(DEFAULT_CLOCK, key, speedOf(handle)));
}

/** 把排队的变更落地，但不推进时间。 */
function applyPending() {
  const events = session.store.step(0);
  for (const entry of events) {
    session.lastEvents.push(entry);
    session.devlog.effect(entry);
  }
}

function speedOf(handle) {
  if (handle === null) return 0;
  const stats = currentView().entity(handle).components["core.stats"];
  return readNumber(stats, "speed", 4);
}

const SAVE_DIR = "saves";
const SAVE_FILE = "saves/quicksave.json";

/** 存档：引擎状态 + 宿主侧（玩家、就绪时刻、调度器、关掉的规则）。 */
function saveGame() {
  if (session === null) return { ok: false, error: "没有进行中的世界" };
  const data = {
    version: 1,
    packs: session.packs,
    engine: session.store.exportState(),
    playerHandle: session.playerHandle,
    playerReadyAt: session.playerReadyAt,
    scheduler: session.scheduler.upcoming(999).map((due) => [due.handle, due.tick]),
    disabled: session.disabled ?? [],
  };
  mkdirSync(SAVE_DIR, { recursive: true });
  writeFileSync(SAVE_FILE, JSON.stringify(data), "utf8");
  return { ok: true, message: "已存档（" + session.store.now() + "）" };
}

/** 读档：把世界恢复到存档那一刻。 */
function loadGame() {
  if (session === null) return { ok: false, error: "没有进行中的世界" };

  let data;
  try {
    data = JSON.parse(readFileSync(SAVE_FILE, "utf8"));
  } catch {
    return { ok: false, error: "还没有存档" };
  }

  session.store.importState(data.engine);
  session.playerHandle = data.playerHandle;
  session.playerReadyAt = data.playerReadyAt;
  session.scheduler = new Scheduler(
    data.scheduler.map(([handle, readyAt]) => ({ handle, readyAt })),
    session.store.now(),
  );
  session.lastEvents = [];
  session.devlog.action(session.store.now(), "读档", { tick: session.store.now() });
  return { ok: true, message: "已读档（tick " + session.store.now() + "）" };
}
/** 技能显示名从链接表里取，不在代码里写死。 */
function skillName(tag) {
  const sym = session.link.tags.get(tag);
  const signature = sym === undefined ? undefined : session.link.signatures[sym];
  return signature?.skill?.name ?? tag;
}

function speedOfPlayer() {
  if (session.playerHandle === null) return 0;
  const stats = currentView().entity(session.playerHandle).components["core.stats"];
  return readNumber(stats, "speed", 0);
}

// ── HTTP ────────────────────────────────────────────────

function sendJson(response, value) {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
  });
}

const server = createServer(async (request, response) => {
  try {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(renderPage(LAUNCHER_PAGE));
      return;
    }

    if (request.url.startsWith("/game")) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(renderPage(GAME_PAGE));
      return;
    }

    if (request.url === "/api/worlds") {
      // 启动器专用：永远返回世界列表，不受「已有会话」影响。
      sendJson(response, scanWorlds());
      return;
    }

    if (request.url === "/api/state") {
      sendJson(response, session === null ? { launcher: true, ...scanWorlds() } : snapshot(""));
      return;
    }

    if (request.url.startsWith("/web/")) {
      const relative = request.url.slice("/web/".length).split("?")[0];
      const root = resolve("web");
      const file = resolve(root, relative);
      if (!file.startsWith(root)) {
        response.writeHead(403);
        response.end("forbidden");
        return;
      }
      try {
        const data = readFileSync(file);
        const type = extname(file) === ".js" ? "text/javascript; charset=utf-8" : "application/octet-stream";
        response.writeHead(200, { "content-type": type });
        response.end(data);
      } catch {
        response.writeHead(404);
        response.end("not found");
      }
      return;
    }

    if (request.method === "POST" && request.url === "/api/leave") {
      session = null;
      sendJson(response, { launcher: true, ...scanWorlds() });
      return;
    }

    if (request.method === "POST" && request.url === "/api/start") {
      const { id, off } = await readBody(request);
      const disabled = new Set(Array.isArray(off) ? off : []);
      try {
        const { byId } = collectPacks();
        session = buildSession(closureOf(String(id), byId), disabled);
        session.disabled = [...disabled];
        sendJson(response, snapshot("世界已载入"));
      } catch (error) {
        sendJson(response, { launcher: true, worlds: [], errors: [{ id, error: messageOf(error) }] });
      }
      return;
    }

    if (request.method === "POST" && request.url === "/api/act") {
      const { dir } = await readBody(request);
      sendJson(response, act(String(dir)));
      return;
    }

    if (request.method === "POST" && request.url === "/api/save") {
      const result = saveGame();
      sendJson(response, result.ok ? snapshot(result.message) : { error: result.error });
      return;
    }

    if (request.method === "POST" && request.url === "/api/load") {
      const result = loadGame();
      sendJson(response, result.ok ? snapshot(result.message) : snapshot(result.error));
      return;
    }
    if (request.method === "POST" && request.url === "/api/graph") {
      const { id } = await readBody(request);
      try {
        const { byId } = collectPacks();
        const ordered = closureOf(String(id), byId);
        const merged = mergePacks(ordered);
        const worldDef = [...merged.definitions.values()].find((def) => def.kind === "world");
        const rules = [];
        if (worldDef && typeof worldDef.data.rules === "object" && Array.isArray(worldDef.data.rules)) {
          rules.push(...worldDef.data.rules.filter((rule) => typeof rule === "string"));
        }
        const graph = buildGraph(merged, rules);
        // 外显名与介绍：查语言包，查不到就退回 id。
        const label = (kind, id) => MESSAGES[kind + "." + id + ".name"] ?? String(id);
        const describe = (kind, id) => MESSAGES[kind + "." + id + ".desc"] ?? "";
        const nodes = graph.nodes.map((node) => ({
          ...node,
          display: label(node.kind, node.label),
          description: describe(node.kind, node.label),
        }));
        sendJson(response, { ok: true, nodes });
      } catch (error) {
        sendJson(response, { ok: false, error: messageOf(error) });
      }
      return;
    }

    if (request.method === "POST" && request.url === "/api/inspect") {
      const { x, y } = await readBody(request);
      sendJson(response, inspectCell(Number(x), Number(y)));
      return;
    }

    if (request.method === "POST" && request.url === "/api/aim") {
      const { tag, x, y } = await readBody(request);
      sendJson(response, aimAt(String(tag), Number(x), Number(y)));
      return;
    }

    if (request.method === "POST" && request.url === "/api/skill") {
      const { tag, x, y } = await readBody(request);
      sendJson(response, useSkill(String(tag), x === undefined ? undefined : Number(x), y === undefined ? undefined : Number(y)));
      return;
    }

    response.writeHead(404);
    response.end("not found");
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: messageOf(error) }));
  }
});

// 命令行给了目录就直接进那个世界，否则进启动器。
const dirs = process.argv.slice(2);
if (dirs.length > 0) {
  const contents = dirs.map(readPack);
  const byId = new Map(contents.map((content) => [content.pack.id, content]));
  const ordered = orderPacks(contents.map((content) => content.pack)).map((pack) => byId.get(pack.id));
  session = buildSession(ordered);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`新世界 · 调试台：http://127.0.0.1:${PORT}`);
});

// ── 页面 ────────────────────────────────────────────────

