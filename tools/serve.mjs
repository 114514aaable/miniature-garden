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
import { loadWorld } from "../game/engine/core/src/pack/load.ts";
import { applyInit } from "../game/engine/core/src/pack/init.ts";
import { mergePacks } from "../game/engine/core/src/pack/merge.ts";
import { orderPacks } from "../game/engine/core/src/pack/order.ts";
import { evaluate } from "../game/engine/core/src/event/evaluate.ts";
import { collectEffects } from "../game/engine/core/src/event/effects.ts";
import { Registry } from "../game/engine/core/src/event/registry.ts";
import { createWorldView } from "../game/engine/core/src/event/view.ts";
import { Store } from "../game/engine/core/src/store.ts";
import { clampCost, costOf, DEFAULT_CLOCK, MAX_ACTION_COST } from "../game/engine/core/src/rules/clock.ts";
import { MAX_SEQUENCE_TICKS } from "../game/engine/core/src/event/registry.ts";
import { Scheduler } from "../game/engine/core/src/rules/scheduler.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { createProjector } from "../game/systems/render/project.ts";
import { buildGraph } from "../game/engine/core/src/pack/graph.ts";
import { DevLog, formatLine } from "../game/systems/log/devlog.ts";
import { runPhases } from "../game/systems/tick/phases.ts";
import { EMPTY_PENDING, isActive, PENDING } from "../game/engine/core/src/rules/pending.ts";
import { RULE_TABLE } from "../game/systems/rules/index.ts";
import { resolveTag, resolveTags } from "../game/systems/rules/aliases.ts";
import { SceneStack, sceneFromComponent } from "../game/systems/scene/scene.ts";
import { createDialogScene, parseDialogScript } from "../game/systems/scene/dialog.ts";
import { selectTargets } from "../game/engine/core/src/traversal/select.ts";
import { nearestWhere } from "../game/engine/core/src/space.ts";
import { buildPassage } from "../game/systems/rules/passage.ts";
import { clampSize, generateTerrain } from "../game/engine/core/src/worldgen/generate.ts";
import { generateCaves } from "../game/engine/core/src/worldgen/caves.ts";
import { createSandbox, runPipeline } from "../game/engine/core/src/worldgen/pipeline.ts";
import { offsetsOf } from "../game/engine/core/src/traversal/shapes.ts";
import { cellsOf } from "../game/engine/core/src/traversal/resolve.ts";

const LOCALE = "zh-CN";
let MESSAGES = {};
try {
  MESSAGES = JSON.parse(readFileSync(`game/locales/${LOCALE}.json`, "utf8"));
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
const WORLDS_DIR = "game/worlds";
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
      const loaded = loadWorld(mergePacks(ordered));
      return {
        id: root.pack.id,
        version: root.pack.version,
        // 启动器直接显示中文名，不用再查语言包
        name: MESSAGES["world." + root.pack.id + ".name"] ?? root.pack.id,
        description: MESSAGES["world." + root.pack.id + ".desc"] ?? "",
        startMenu: loaded.world.startMenu ?? { fields: [{ key: "seed", label: "种子", type: "number", default: 0 }] },
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

/** 把生成的图换进包的定义里（这样还是走 loadWorld 那一道校验）。 */
function withGeneratedSpace(merged, loaded, seed, options) {
  const none = { merged, note: null };
  const generation = loaded.world.generation;
  if (generation === undefined) return none;

  const width = Number(options?.width);
  const height = Number(options?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return none;

  const ids = new Map();
  for (const terrain of loaded.terrains.values()) {
    if (terrain.code !== undefined) ids.set(terrain.code, terrain.id);
  }

  // 这张图至少要放得下现有内容（实体坐标 + 预制件尺寸），否则放大
  let needWidth = 0;
  let needHeight = 0;
  for (const entity of loaded.entities) {
    needWidth = Math.max(needWidth, entity.pos.x + 2);
    needHeight = Math.max(needHeight, entity.pos.y + 2);
  }
  for (const stamp of loaded.world.init ?? []) {
    if (stamp.kind !== "stamp") continue;
    const group = loaded.groups.get(stamp.group);
    if (group === undefined) continue;
    let maxDx = 0;
    let maxDy = 0;
    for (const item of group.entities) {
      maxDx = Math.max(maxDx, item.dx);
      maxDy = Math.max(maxDy, item.dy);
    }
    needWidth = Math.max(needWidth, stamp.x + maxDx + 2);
    needHeight = Math.max(needHeight, stamp.y + maxDy + 2);
  }

  let generated;
  try {
    generated = Array.isArray(generation.pipeline)
      ? runPipelineToTerrain(generation.pipeline, seed, clampSize(Math.max(width, needWidth)), clampSize(Math.max(height, needHeight)), loaded, ids)
      : generation.generator === "caves"
      ? cavesToTerrain(generation, seed, clampSize(Math.max(width, needWidth)), clampSize(Math.max(height, needHeight)), ids)
      : generateTerrain({
      seed,
      width: clampSize(Math.max(width, needWidth)),
      height: clampSize(Math.max(height, needHeight)),
      fields: generation.fields ?? {},
      biomes: loaded.biomes,
      terrainIdByCode: ids,
      levels: generation.levels ?? {},
    });
  } catch (error) {
    console.warn("[worldgen] " + messageOf(error));
    return none;
  }

  const spaceId = loaded.world.start.space;
  const definitions = new Map(merged.definitions);
  const key = "space:" + spaceId;
  const existing = definitions.get(key);
  if (existing === undefined) return none;

  definitions.set(key, {
    ...existing,
    data: { id: spaceId, width: generated.width, height: generated.height, terrain: [...generated.terrain] },
  });

  // 出生点夹进新范围（具体能不能站交给 loadWorld 处理）
  const worldDef = definitions.get("world:main");
  if (worldDef !== undefined) {
    const start = worldDef.data.start ?? {};
    definitions.set("world:main", {
      ...worldDef,
      data: {
        ...worldDef.data,
        start: {
          space: spaceId,
          x: Math.min(Math.max(Number(start.x) || 0, 1), generated.width - 2),
          y: Math.min(Math.max(Number(start.y) || 0, 1), generated.height - 2),
        },
      },
    });
  }

  const targetWidth = clampSize(Math.max(width, needWidth));
  const targetHeight = clampSize(Math.max(height, needHeight));
  const note =
    targetWidth !== clampSize(width) || targetHeight !== clampSize(height)
      ? `这张图放不下现有内容，已放大到 ${generated.width}×${generated.height}`
      : null;

  return { merged: { ...merged, definitions }, note };
}

/** 流水线 → 地形数组（地表、洞穴、混合都可以）。 */
function runPipelineToTerrain(steps, seed, width, height, loaded, ids) {
  const fallback = ids.get("floor");
  if (fallback === undefined) throw new Error("流水线需要一个 floor 地形");

  const sandbox = createSandbox(seed, width, height, fallback);
  runPipeline(sandbox, steps, { biomes: loaded.biomes, terrainIdByCode: ids });

  return { width: sandbox.width, height: sandbox.height, terrain: sandbox.terrain, stats: {} };
}

/** 元胞地牢：墙/空 → 地形号。 */
function cavesToTerrain(generation, seed, width, height, ids) {
  const caves = generateCaves({
    seed,
    width,
    height,
    fill: generation.fill ?? 0.46,
    iterations: generation.iterations ?? 5,
    spawnClear: generation.spawnClear ?? 2,
    regions: generation.regions ?? 1,
    chambers: generation.chambers ?? 1,
  });

  const wall = ids.get("wall");
  const floor = ids.get("floor");
  if (wall === undefined || floor === undefined) {
    throw new Error("元胞世界需要地形代号 wall 与 floor");
  }

  return {
    width: caves.width,
    height: caves.height,
    terrain: caves.walls.map((isWall) => (isWall ? wall : floor)),
    stats: { walls: caves.walls.length - caves.floorCount, floors: caves.floorCount },
  };
}

function buildSession(ordered, disabled = new Set(), seed = 0, runInit = true, offTemplates = new Set(), options = {}) {
  const merged0 = mergePacks(ordered);
  const base = loadWorld(merged0);
  const generated = withGeneratedSpace(merged0, base, seed, options);
  const merged = generated.merged;

  let loaded = base;
  let generationNote = generated.note;
  if (merged !== merged0) {
    try {
      loaded = loadWorld(merged);
    } catch (error) {
      // 地图太小放不下建筑之类：退回原地图，别让人打不开
      generationNote = "这张图放不下现有内容（" + messageOf(error) + "），改用默认地图";
      loaded = base;
    }
  }

  // 物种 × 地形：两边各自声明，加载期对接一次
  const templateIds = [...merged.definitions.values()].filter((def) => def.kind === "template").map((def) => def.id);
  const passage = buildPassage(
    [...loaded.terrains.values()],
    templateIds.map((id) => ({ id, components: loaded.templates.get(id).components })),
  );

  const store = new Store(loaded.spaces, { templates: loaded.templates });
  for (const entity of loaded.entities) {
    if (offTemplates.has(entity.template)) continue;
    store.submit({
      kind: "spawn",
      space: entity.space,
      cell: entity.pos,
      template: entity.template,
      overrides: entity.overrides,
    });
  }
  // 包里没有 pc 就在出生点放一个（玩家是宿主概念，不是世界内容）
  if (!loaded.entities.some((entity) => entity.template === "pc")) {
    store.submit({ kind: "spawn", space: loaded.start.space, cell: loaded.start.pos, template: "pc" });
  }

  const spawnEvents = store.step();

  // 开局初始化：只在「新开局」执行（读档跳过）。
  if (runInit) {
    applyInit(store, loaded);
  }

  // 场景栈：explore 永远在最底；对话/战斗往上压
  const exploreScene = { id: "explore", input: [], handle: () => ({}) };
  const scenes = new SceneStack(new Map([["explore", exploreScene]]), sceneFromComponent(undefined));

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
          { name: "core.intent", required: false },
          { name: "core.pending", required: false },
          { name: "core.disposition", required: false },
          { name: "core.dialog", required: false },
          { name: "core.persistence", required: false },
          { name: "core.item", required: false },
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
    passage,
    store,
    link,
    handlers,
    skills,
    projector,
    playerHandle,
    scheduler,
    playerReadyAt: store.now(),
    packs: ordered.map((content) => `${content.pack.id}@${content.pack.version}`),
    seed,
    lastEvents: [],
    frames: [],
    scenes,
    devlog: new DevLog(),
  };

  session.generationNote = generationNote;
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

/** 阵营：没声明就当中立。 */
function dispositionOf(component) {
  if (typeof component !== "object" || component === null || Array.isArray(component)) return "neutral";
  const value = component.value;
  return value === "hostile" || value === "friendly" ? value : "neutral";
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

function snapshot(message = "") {
  const notice = session.notice ?? null;
  session.notice = null;

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
    seed: session.seed,
    options: session.options ?? {},
    dead: session.dead === true,
    scene: sceneView(),
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
    message: notice ?? message,
    rules: session.loaded.rules,
    packs: session.packs,
    worldHash: session.loaded.hash,
    skills: session.skills.map((skill) => ({
      tag: skill.tag,
      name: skill.name,
      cost: skill.cost,
      target: {
        kind: skill.target.kind,
        range: skill.target.range,
        ...(skill.target.component === undefined ? {} : { component: skill.target.component }),
        ...(skill.target.filter === undefined ? {} : { filter: skill.target.filter }),
      },
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

/** 动作最小间隔（毫秒）：防长按 / 连点把世界一口气推进很远。 */
const ACTION_INTERVAL = 60;

/** 太快就拒绝；同时更新最后一次动作时间。 */
function tooFast() {
  const now = Date.now();
  if (now - (session.lastActionAt ?? 0) < ACTION_INTERVAL) return true;
  session.lastActionAt = now;
  return false;
}

function act(command) {
  if (tooFast()) return snapshot("慢一点");
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
/** 当前场景的渲染数据（客户端只认这个，不认识脚本）。 */
function sceneView() {
  if (session === null) return null;
  const top = session.scenes.top();
  return {
    id: top.id,
    depth: session.scenes.depth(),
    input: session.scenes.input(),
    view: typeof top.describe === "function" ? top.describe() : null,
  };
}

/** 读一个对话脚本（世界包里的 dialogs/*.json）。 */
function loadDialogScript(scriptId) {
  const world = session.world ?? "";
  const path = "game/worlds/" + world + "/dialogs/" + scriptId + ".json";
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return createDialogScene(parseDialogScript(raw));
}

/** 压一个场景上去。 */
function pushScene(id, params) {
  if (id !== "dialog") {
    return { ok: false, error: "第一版只支持 dialog 场景" };
  }
  const scriptId = String(params.script ?? "");
  let scene;
  try {
    scene = loadDialogScript(scriptId);
  } catch (error) {
    return { ok: false, error: "读不到对话脚本：" + messageOf(error) };
  }
  session.scenes.register(scene);
  session.scenes.push("dialog", params);
  return { ok: true };
}

/** 把一个命令交给场景，并执行它返回的意图。 */
function sceneCommand(command) {
  let result;
  try {
    result = session.scenes.handle(command, session.store.now());
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }

  if (result.next !== undefined) {
    const next = result.next;
    if (next.op === "pop") session.scenes.pop();
    else if (next.op === "push" && typeof next.id === "string") session.scenes.push(next.id, next.params ?? {});
    else if (next.op === "replace" && typeof next.id === "string") session.scenes.replace(next.id, next.params ?? {});
  }

  for (const effect of result.effects ?? []) session.store.submit(effect);

  return { ok: true };
}

/** 玩家背包里有什么（名字、描述都带上，界面不用再查）。 */
function inventoryList() {
  if (session === null || session.playerHandle === null) {
    return { ok: true, items: [] };
  }

  const view = currentView();
  const bag = view.entity(session.playerHandle).components["core.container"];
  const handles = bag && Array.isArray(bag.items) ? bag.items.filter((h) => typeof h === "number") : [];

  const items = [];
  for (const handle of handles) {
    if (!session.store.hasEntity(handle)) continue;
    const entity = view.entity(handle);
    items.push({
      handle,
      template: entity.template,
      name: MESSAGES["template." + entity.template + ".name"] ?? entity.template,
      description: MESSAGES["template." + entity.template + ".desc"] ?? "",
    });
  }

  return { ok: true, items };
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
/** 名字 → 条件；没有就返回 undefined（调用方退化到旧写法）。 */
function conditionFor(name) {
  if (typeof name !== "string") return undefined;
  return session.loaded.traversal.filters[name];
}

/** 在给定的格子里按命名过滤挑目标。 */
function selectIn(cells, filterName, options = {}) {
  const condition = conditionFor(filterName);
  if (condition === undefined) return [];

  const view = currentView();
  const spaceId = activeSpaceId();
  if (spaceId === null) return [];
  const space = session.store.space(spaceId);

  const selector = {
    occupantsAt: (cell) => space.occupantsAt(cell),
    componentsOf: (handle) => view.entity(handle).components,
  };

  return selectTargets(selector, cells, condition, options);
}

/**
 * 范围技能的高亮：用遍历核心算「以施法者为中心、命名形状」的格子。
 * 规则层命中判定也用同一份偏移，所以画的和打的一定一致。
 */
function aimArea(shapeName, actorHandle, anchor, x, y) {
  const actor = session.store.entity(actorHandle);
  if (actor.pos === null || actor.space === null) {
    return { ok: false, cells: [], reason: "它不在任何地方" };
  }

  const spec = session.loaded.traversal;
  let offsets;
  try {
    offsets = offsetsOf(spec, shapeName);
  } catch (error) {
    return { ok: false, cells: [], reason: messageOf(error) };
  }

  const space = session.store.space(actor.space);
  // 锚点：默认跟着自己；anchor === "cell" 时跟着鼠标格
  const origin = anchor === "cell" && x !== undefined && y !== undefined
    ? { x, y }
    : actor.pos;
  const cells = cellsOf(origin, offsets, { width: space.width, height: space.height });
  return { ok: true, cells: cells.map((cell) => [cell.x, cell.y]), reason: null };
}

/** 规则能用到的宿主能力：形状、选定。和 aim 用同一份数据。 */
function ruleTools() {
  return {
    offsets(shape) {
      try {
        return offsetsOf(session.loaded.traversal, shape);
      } catch {
        return undefined;
      }
    },
    select(cells, filter, options) {
      return selectIn(cells, filter, options);
    },
    canEnter(handle, spaceId, cell) {
      const entity = session.store.entity(handle);
      const space = session.store.space(spaceId);
      return session.passage.canEnter(entity.template, space.terrainAt(cell));
    },
  };
}

/**
 * 玩家脚下的格子必须能站。
 *
 * 什么时候会站不住：换了地图、读档、地图重新生成之后。
 * 处理：挪到最近一个能站的格子，并在界面留一句话。
 */
function ensurePlayerOnWalkable() {
  if (session === null) return;

  if (session.playerHandle === null) return;

  const player = session.store.entity(session.playerHandle);
  if (player.pos === null || player.space === null) return;

  const space = session.store.space(player.space);
  const passable = (cell) => {
    const terrain = session.loaded.terrains.get(space.terrainAt(cell));
    return (
      terrain !== undefined &&
      session.passage.canEnter(player.template, space.terrainAt(cell)) &&
      // 自己站在这里不算「有人占着」
      space.occupantsAt(cell).every((handle) => handle === session.playerHandle)
    );
  };

  if (passable(player.pos)) return;

  const target = nearestWhere(space, player.pos, passable);
  if (target === null) {
    session.notice = "脚下的地不能站，而且附近没有能站的地方";
    return;
  }

  session.store.inject({ kind: "remove", space: player.space, cell: player.pos, handle: session.playerHandle });
  session.store.inject({ kind: "place", space: player.space, cell: target, handle: session.playerHandle });
  session.notice = "脚下的地不能站，被挪到了 (" + target.x + ", " + target.y + ")";
}

function aimAt(tag, x, y) {
  const sym = session.link.tags.get(tag);
  const signature = sym === undefined ? undefined : session.link.signatures[sym];
  if (signature === undefined || signature.skill === undefined) {
    return { ok: false, cells: [], reason: "没有这个技能" };
  }
  if (signature.skill.target.kind === "self") {
    return { ok: false, cells: [], reason: "这个技能不需要目标" };
  }

  if (signature.skill.target.kind === "area") {
    return aimArea(
      String(signature.skill.target.shape ?? ""),
      session.playerHandle,
      signature.skill.target.anchor,
      x,
      y,
    );
  }

  const kind = signature.skill.target.kind === "entity" ? "entity" : "cell";
  const result = evaluate(
    {
      id: session.store.now() + 1,
      tag: "core.aim",
      params: {
        actor: session.playerHandle,
        kind,
        range: signature.skill.target.range,
        ...(signature.skill.target.component === undefined ? {} : { component: signature.skill.target.component }),
        ...(conditionFor(signature.skill.target.filter) === undefined
          ? {}
          : { condition: conditionFor(signature.skill.target.filter) }),
        x,
        y,
      },
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

/** 给「目标为实体」的技能找目标：有坐标取那格，没坐标取相邻。 */
function resolveTarget(x, y, filterName) {
  if (typeof filterName === "string" && x !== undefined && y !== undefined) {
    const found = selectIn([{ x, y }], filterName, { exclude: session.playerHandle, limit: 1 });
    return found[0];
  }
  const me = session.store.entity(session.playerHandle);
  if (me.pos === null || me.space === null) return undefined;
  const space = session.store.space(me.space);

  if (x !== undefined && y !== undefined) {
    const occupant = space.occupantsAt({ x, y }).find((handle) => handle !== session.playerHandle);
    return occupant;
  }

  const neighbours = [
    { x: me.pos.x + 1, y: me.pos.y },
    { x: me.pos.x - 1, y: me.pos.y },
    { x: me.pos.x, y: me.pos.y + 1 },
    { x: me.pos.x, y: me.pos.y - 1 },
  ];
  for (const cell of neighbours) {
    for (const handle of space.occupantsAt(cell)) {
      if (handle === session.playerHandle) continue;
      const entity = currentView().entity(handle);
      if (entity.components["core.dialog"] !== undefined) return handle;
    }
  }
  return undefined;
}

function useSkill(tag, x, y, extra = {}) {
  if (tooFast()) return snapshot("慢一点");

  const sym = session.link.tags.get(tag);
  const signature = sym === undefined ? undefined : session.link.signatures[sym];
  if (signature === undefined || signature.skill === undefined) {
    return snapshot("没有这个技能");
  }

  if (signature.skill.target.kind === "self") {
    return run(tag, { actor: session.playerHandle, ...extra }, signature.skill.cost);
  }

  if (signature.skill.target.kind === "entity") {
    // 按签名声明的字段组参数：有的技能要 target（交谈），有的要 x/y（劈砍）
    const fields = signature.params.fields ?? {};
    const params = { actor: session.playerHandle };
    if (fields.target !== undefined) {
      const handle = resolveTarget(x, y, signature.skill.target.filter);
      if (handle === undefined) {
        return snapshot("没有可以指向的目标");
      }
      params.target = handle;
    }
    if (fields.x !== undefined && x !== undefined) params.x = x;
    if (fields.y !== undefined && y !== undefined) params.y = y;
    return run(tag, { ...params, ...extra }, signature.skill.cost);
  }

  if (signature.skill.target.kind === "area") {
    // 范围技能以自己为中心，不需要点格子
    return run(tag, { actor: session.playerHandle, ...extra }, signature.skill.cost);
  }

  if (x === undefined || y === undefined) {
    return snapshot(`${signature.skill.name} 需要先指出目标格`);
  }

  return run(tag, { actor: session.playerHandle, x, y, ...extra }, signature.skill.cost);
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

  const result = evaluate(envelope, session.link, session.handlers, currentView(), { tools: ruleTools() });
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

  // 落空也要说话：否则玩家分不清「他打偏了」和「他没出手」
  if (result.value.missed === true) {
    session.devlog.action(session.store.now(), tag + ' 落空', { mode: result.value.mode ?? 'fixed' });
  }

  // 规则可以返回「场景意图」——宿主执行，规则不碰场景栈
  if (result.value.scene !== undefined && result.value.scene !== null) {
    const intent = result.value.scene;
    if (intent.op === "push" && typeof intent.id === "string") {
      pushScene(intent.id, intent.params ?? {});
    } else if (intent.op === "pop") {
      session.scenes.pop();
    }
  }

  const effects = collectEffects(result.value);
  for (const effect of effects) {
    session.store.submit(effect);
  }

  // 动作生效，然后世界推进到玩家下次能行动为止（敌人会在这段里行动）。
  // 注意：成本不看「有没有效果」——等待就是不产生效果但照样花时间。
  const skillSym = session.link.tags.get(tag);
  const skillSignature = skillSym === undefined ? undefined : session.link.signatures[skillSym];
  const time = skillSignature?.time;

  let rawCost;
  try {
    rawCost = costOf(DEFAULT_CLOCK, costKey, speedOfPlayer());
  } catch (error) {
    session.devlog.action(session.store.now(), tag + " 成本未定义", { cost: costKey });
    return snapshot("这个技能的成本没定义：" + costKey);
  }
  const cost =
    time?.mode === "sequence"
      ? Math.min(MAX_SEQUENCE_TICKS, Math.max(1, Math.floor(time.ticks ?? 1)))
      : clampCost(rawCost);
  if (cost !== rawCost) {
    session.devlog.action(session.store.now(), tag + " 成本超限", {
      raw: rawCost,
      capped: cost,
      max: MAX_ACTION_COST,
    });
  }
  session.playerReadyAt = session.store.now() + cost;
  session.lastEvents = [];
  session.frames = [];
  advanceTo(session.playerReadyAt);

  // 死亡入口：玩家实体不在了，就停下来（以后可以发 core.death 让世界包接管）
  if (session.playerHandle !== null && !session.store.hasEntity(session.playerHandle)) {
    session.dead = true;
  }


  const rounds = cost === 0 ? "（零帧）" : `（${cost} 回合）`;
  const snap = snapshot(`${skillName(tag)}${rounds}`);

  // 这一动作推进过程中的每 tick 增量（客户端按帧播放）
  if (session.frames.length > 0) snap.frames = session.frames;

  if (time?.mode === "sequence") {
    snap.sequence = {
      ticks: cost,
      events: session.lastEvents.map((entry) => `#${entry.id} ${entry.kind} ${JSON.stringify(entry.data)}`),
    };
  }

  return snap;
}

/**
 * 逐 tick 推进世界。
 *
 * 玩家用一次 cost 表示动作占多少回合，但敌人是逐 tick 结算的，
 * 所以不能 step(cost) 一次跳完——中间要给敌人行动的机会。
 */
/**
 * 每 tick 的阶段表。顺序就是语义：
 *   推进 → 清理死者 → 结算挂起 → 敌人行动
 */
function tickPhases() {
  return [
    {
      name: "step",
      run: () => {
        const events = session.store.step(1);
        for (const entry of events) {
          session.lastEvents.push(entry);
          session.devlog.effect(entry);
        }
      },
    },
    { name: "prune", run: () => session.scheduler.prune((handle) => session.store.hasEntity(handle)) },
    { name: "pending", run: () => resolvePending() },
    { name: "enemies", run: () => drainEnemies() },
  ];
}

/** 一帧的数据上限：防止超长动作把响应撑爆。 */
const MAX_FRAMES = 200;

/** 把当前实体状态抓成 map：handle → { x, y, hp }（帧 diff 用）。 */
function captureSnapshotOfEntities(view) {
  const map = new Map();
  for (const raw of session.store.allEntities()) {
    const entity = view.entity(raw.handle);
    const health = entity.components["core.health"];
    const hp =
      typeof health === "object" && health !== null && typeof health.hp === "number" ? health.hp : null;
    map.set(entity.handle, {
      x: entity.pos === null ? null : entity.pos.x,
      y: entity.pos === null ? null : entity.pos.y,
      hp,
    });
  }
  return map;
}

/** 对比前后两拍，产出这一帧的增量。 */
function diffFrame(view, prev, tick, events) {
  const moves = [];
  const hp = [];

  for (const raw of session.store.allEntities()) {
    const entity = view.entity(raw.handle);
    const before = prev.get(raw.handle);
    const health = entity.components["core.health"];
    const nowHp =
      typeof health === "object" && health !== null && typeof health.hp === "number" ? health.hp : null;
    const now = { x: entity.pos === null ? null : entity.pos.x, y: entity.pos === null ? null : entity.pos.y };

    if (before === undefined) {
      moves.push({ handle: raw.handle, x: now.x, y: now.y, spawned: true });
      continue;
    }
    if (before.x !== now.x || before.y !== now.y) moves.push({ handle: raw.handle, x: now.x, y: now.y });
    if (before.hp !== nowHp && nowHp !== null) hp.push({ handle: raw.handle, hp: nowHp });
  }

  const alive = new Set(session.store.allEntities().map((entity) => entity.handle));
  for (const handle of prev.keys()) {
    if (!alive.has(handle)) moves.push({ handle, removed: true });
  }

  return {
    tick,
    moves,
    hp,
    events: events.map((entry) => `#${entry.id} ${entry.kind} ${JSON.stringify(entry.data)}`),
  };
}
function advanceTo(target) {
  if (!Number.isFinite(target)) {
    session.devlog.action(session.store.now(), "调度器", { error: "target 不是数字" });
    return;
  }

  const phases = tickPhases();
  let guard = 0;
  while (session.store.now() < target) {
    const view = currentView();
    const before = captureSnapshotOfEntities(view);
    const eventsBefore = session.lastEvents.length;
    if (guard++ > 512) {
      session.devlog.action(session.store.now(), "调度器", { error: "推进次数超限" });
      // 没推到目标就把“下次能行动”拉回当前时刻，否则玩家会永远卡在“恢复中”
      session.playerReadyAt = session.store.now();
      session.notice = "动作太长，被截断在 " + session.store.now() + " 回合";
      break;
    }
    runPhases(phases, session.store.now());

    // 这一 tick 新产生的事件（step 阶段会往 lastEvents 里追加）
    const events = session.lastEvents.slice(eventsBefore);
    if (session.frames.length < MAX_FRAMES) {
      session.frames.push(diffFrame(view, before, session.store.now(), events));
    }
  }
  applyPending();
}

/** 到点的挂起动作：求值它记下的信封，然后清空。 */
function resolvePending() {
  const now = session.store.now();
  const view = currentView();

  for (const entity of session.store.allEntities()) {
    const pending = view.entity(entity.handle).components[PENDING];
    if (!isActive(pending)) continue;
    if (pending.resolveAt > now) continue;

    const result = evaluate(
      { id: now + 1000, tag: String(pending.tag), params: pending.params },
      session.link,
      session.handlers,
      view,
    );

    const done = result.ok && result.value && result.value.ok === true;
    if (done) {
      for (const effect of collectEffects(result.value)) {
        session.store.submit(effect);
      }
    }

    session.store.submit({ kind: "patch", handle: entity.handle, component: PENDING, data: EMPTY_PENDING });
    session.devlog.action(now, "挂起结算", { handle: entity.handle, tag: pending.tag, ok: done });
  }
}

/** 让当前 tick 该行动的敌人行动（可能连续多个）。 */
/** 玩家现在所在的空间（没有玩家就是第一个空间）。 */
function activeSpaceId() {
  if (session === null || session.playerHandle === null) return null;
  try {
    return session.store.entity(session.playerHandle).space;
  } catch {
    return null;
  }
}

function drainEnemies() {
  const now = session.store.now();
  let guard = 0;
  for (;;) {
    const due = session.scheduler.peek();
    if (due === null || due.tick > now) break;
    if (guard++ > 64) break;

    session.scheduler.take();

    // 不在当前空间的角色：先不跑，往后挪一批。否则别的图的敌人会自己打起来。
    const entity = session.store.entity(due.handle);
    if (entity.space !== null && entity.space !== activeSpaceId()) {
      session.scheduler.done(due.handle, 50);
      continue;
    }

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

  const key = next.tag === "base.attack" ? "attack" : "move";
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
const SELECTION_FILE = "saves/selection.json";

/** 每个世界「关掉了哪些规则」。给 AI 和界面共用的外置接口。 */
function readSelection() {
  try {
    return JSON.parse(readFileSync(SELECTION_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeSelection(all) {
  mkdirSync(SAVE_DIR, { recursive: true });
  writeFileSync(SELECTION_FILE, JSON.stringify(all, null, 2), "utf8");
}
const SAVE_FILE = "saves/quicksave.json";

/** 槽位名只允许字母数字下划线短横，防止路径穿越。 */
function slotPath(slot) {
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(slot)) {
    throw new Error("槽位名只能用字母、数字、下划线、短横（1–32 个字）");
  }
  return SAVE_DIR + "/" + slot + ".json";
}

/** 列出所有存档（按时间倒序）。坏的存档跳过，不拖垮列表。 */
function listSaves() {
  let names = [];
  try {
    names = readdirSync(SAVE_DIR);
  } catch {
    return [];
  }

  const saves = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const slot = name.slice(0, -".json".length);
    try {
      const data = JSON.parse(readFileSync(SAVE_DIR + "/" + name, "utf8"));
      saves.push({
        slot,
        world: data.world ?? null,
        seed: data.seed ?? 0,
        savedAt: data.savedAt ?? null,
        tick: data.engine?.tick ?? 0,
        packs: data.packs ?? [],
        bytes: readFileSync(SAVE_DIR + "/" + name).length,
      });
    } catch {
      saves.push({ slot, broken: true });
    }
  }

  return saves.sort((a, b) => String(b.savedAt ?? "").localeCompare(String(a.savedAt ?? "")));
}


/** 存档：引擎状态 + 宿主侧（玩家、就绪时刻、调度器、关掉的规则）。 */
function saveGame(slot = "quick") {
  if (session === null) return { ok: false, error: "没有进行中的世界" };
  const data = {
    version: 1,
    world: session.world ?? null,
    savedAt: new Date().toISOString(),
    packs: session.packs,
    engine: session.store.exportState(),
    playerHandle: session.playerHandle,
    seed: session.seed,
    playerReadyAt: session.playerReadyAt,
    scheduler: session.scheduler.upcoming(999).map((due) => [due.handle, due.tick]),
    disabled: session.disabled ?? [],
    options: session.options ?? {},
    // 场景栈连同每层的内部状态（比如对话说到第几句）
    scene: session.scenes.export(),
  };
  mkdirSync(SAVE_DIR, { recursive: true });
  writeFileSync(slotPath(slot), JSON.stringify(data), "utf8");
  return { ok: true, message: "已存档（" + session.store.now() + "）" };
}

/** 读档：把世界恢复到存档那一刻。 */
function loadGame(slot = "quick") {
  let data;
  try {
    data = JSON.parse(readFileSync(slotPath(slot), "utf8"));
  } catch {
    return { ok: false, error: "还没有存档" };
  }

  if (typeof data.world !== "string" || !Array.isArray(data.packs)) {
    return { ok: false, error: "存档缺少世界信息，可能是旧格式" };
  }

  let ordered;
  try {
    const { byId } = collectPacks();
    ordered = closureOf(data.world, byId);
  } catch (error) {
    return { ok: false, error: "存档要的世界包找不到了：" + messageOf(error) };
  }

  const packs = ordered.map((content) => content.pack.id + "@" + content.pack.version);
  const missing = data.packs.filter((pack) => !packs.includes(pack));
  const extra = packs.filter((pack) => !data.packs.includes(pack));
  if (missing.length > 0 || extra.length > 0) {
    return {
      ok: false,
      error: "存档的包和现在的不一致，拒绝读取（防止读出悬空引用）",
      missing,
      extra,
    };
  }

  // 存档自带规则集：按它的 disabled 重建，再导入状态。
  session = buildSession(
    ordered,
    new Set(resolveTags(data.disabled ?? [])),
    data.seed ?? 0,
    false,
    new Set(),
    data.options ?? {},
  );
  session.world = data.world;
  session.dead = false;
  session.store.importState(data.engine);
  session.playerHandle = data.playerHandle;
  session.seed = data.seed ?? 0;
  session.options = data.options ?? {};
  session.playerReadyAt = data.playerReadyAt;
  session.scheduler = new Scheduler(
    data.scheduler.map(([handle, readyAt]) => ({ handle, readyAt })),
    session.store.now(),
  );

  // 读档后检查玩家站得住（存档的位置可能落在新地图的水里）
  ensurePlayerOnWalkable();

  // 场景：按层重建（对话要重新读脚本），再让每层恢复内部状态
  if (Array.isArray(data.scene) && data.scene.length > 0) {
    const layers = [];
    for (const layer of data.scene) {
      if (layer.id === "dialog") {
        try {
          session.scenes.register(loadDialogScript(String(layer.params?.script ?? "")));
        } catch {
          continue;
        }
      }
      layers.push({
        id: String(layer.id),
        params: layer.params ?? {},
        ...(layer.state === undefined ? {} : { state: layer.state }),
      });
    }
    if (layers.length > 0) session.scenes.restore(layers);
  }
  session.lastEvents = [];
  session.devlog.action(session.store.now(), "读档", { tick: session.store.now(), world: data.world });
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

    if (request.url.startsWith("/api/selection")) {
      const url = new URL(request.url, "http://x");
      const world = url.searchParams.get("world");

      if (request.method === "GET") {
        const all = readSelection();
        const entry = world ? all[world] : null;
        const off = Array.isArray(entry) ? entry : (entry?.off ?? []);
        const offTemplates = Array.isArray(entry) ? [] : (entry?.offTemplates ?? []);
        sendJson(response, { ok: true, world, off, offTemplates, all });
        return;
      }

      const body = await readBody(request);
      const all = readSelection();
      all[String(body.world)] = {
        off: Array.isArray(body.off) ? body.off.filter((r) => typeof r === "string") : [],
        offTemplates: Array.isArray(body.offTemplates)
          ? body.offTemplates.filter((r) => typeof r === "string")
          : [],
      };
      writeSelection(all);
      sendJson(response, { ok: true, world: body.world, ...all[String(body.world)] });
      return;
    }

    if (request.url === "/api/saves") {
      sendJson(response, { ok: true, saves: listSaves() });
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

    if (request.url.startsWith("/client/")) {
      const name = request.url.slice("/client/".length).split("?")[0];
      if (!/^([a-z0-9_-]+\/)*[a-z0-9_-]+\.js$/.test(name)) {
        response.writeHead(404);
        response.end("not found");
        return;
      }
      const text = readFileSync("tools/client/" + name, "utf8");
      response.writeHead(200, {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(text);
      return;
    }

    if (request.url.startsWith("/web/")) {
      // 构建产物每次重启都可能变，别让浏览器吃旧缓存
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
        response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
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
      const { id, off, seed, options } = await readBody(request);
      const disabled = new Set(Array.isArray(off) ? off : []);
      try {
        const { byId } = collectPacks();
        const entry = readSelection()[String(id)];
        const offTemplates = new Set(Array.isArray(entry) ? [] : (entry?.offTemplates ?? []));
        session = buildSession(
          closureOf(String(id), byId),
          new Set([...disabled].map(resolveTag)),
          Number(seed) || 0,
          true,
          offTemplates,
          typeof options === "object" && options !== null ? options : {},
        );
        session.world = String(id);
        // 出生点被挪过（生成地图里正好是水）就在这里说一句
        ensurePlayerOnWalkable();
        if (session.loaded.startWarning !== undefined) session.notice = session.loaded.startWarning;
        session.options = typeof options === "object" && options !== null ? options : {};
        session.dead = false;
        session.disabled = [...disabled];
        const note =
          session.loaded.startWarning ?? session.generationNote ?? "世界已载入";
        sendJson(response, snapshot(note));
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
      const { slot } = await readBody(request);
      const result = saveGame(typeof slot === "string" && slot.length > 0 ? slot : "quick");
      sendJson(response, result.ok ? snapshot(result.message) : { error: result.error });
      return;
    }

    if (request.method === "POST" && request.url === "/api/load") {
      const { slot } = await readBody(request);
      const result = loadGame(typeof slot === "string" && slot.length > 0 ? slot : "quick");
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
          rules.push(...resolveTags(worldDef.data.rules.filter((rule) => typeof rule === "string")));
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

    if (request.method === "POST" && request.url === "/api/scene") {
      const { op, id, params } = await readBody(request);
      if (op === "pop") {
        session.scenes.pop();
        sendJson(response, snapshot("场景已退出"));
        return;
      }
      const pushed = pushScene(String(id), params ?? {});
      sendJson(response, pushed.ok === true ? snapshot("场景已进入") : snapshot("打不开：" + pushed.error));
      return;
    }

    if (request.method === "POST" && request.url === "/api/scene/command") {
      const { command } = await readBody(request);
      const result = sceneCommand(String(command));
      sendJson(response, snapshot(result.ok === true ? "继续" : "不行：" + result.error));
      return;
    }

    if (request.url === "/api/inventory") {
      sendJson(response, inventoryList());
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
      const { tag, x, y, item } = await readBody(request);
      sendJson(response, useSkill(
        String(tag),
        x === undefined ? undefined : Number(x),
        y === undefined ? undefined : Number(y),
        item === undefined ? {} : { item: Number(item) },
      ));
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
  console.log(`箱庭 · 调试台：http://127.0.0.1:${PORT}`);
});

// ── 页面 ────────────────────────────────────────────────

