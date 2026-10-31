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
import { buildFrame, DEFAULT_STYLE } from "../systems/render/draw.ts";
import { createProjector } from "../systems/render/project.ts";

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

function buildSession(ordered) {
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
  registry.define(moveSignature);
  registry.define(takeSignature);
  registry.define(dropSignature);
  registry.define(attackSignature);
  const link = registry.link();

  const handlers = new Map([
    [link.tags.get("core.move"), moveHandler],
    [link.tags.get("core.take"), takeHandler],
    [link.tags.get("core.drop"), dropHandler],
    [link.tags.get("core.attack"), attackHandler],
  ]);

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

  return {
    loaded,
    store,
    link,
    handlers,
    skills,
    projector,
    playerHandle,
    packs: ordered.map((content) => `${content.pack.id}@${content.pack.version}`),
    lastEvents: [],
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
    return { hp: 0, hpMax: 0, inventory: [] };
  }
  const components = currentView().entity(session.playerHandle).components;

  const health = components["core.health"];
  const container = components["core.container"];

  return {
    hp: readNumber(health, "hp", readNumber(health, "max", 0)),
    hpMax: readNumber(health, "max", 0),
    inventory: readNumberArray(container, "items"),
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

  const commands = buildFrame(frame, {
    tile: TILE,
    viewport: VIEWPORT,
    camera: { x: 0, y: 0 },
    style: DEFAULT_STYLE,
  });

  return {
    launcher: false,
    commands,
    viewport: VIEWPORT,
    tile: TILE,
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

function useSkill(tag) {
  const sym = session.link.tags.get(tag);
  const signature = sym === undefined ? undefined : session.link.signatures[sym];
  if (signature === undefined || signature.skill === undefined) {
    return snapshot("没有这个技能");
  }

  if (signature.skill.target.kind === "self") {
    return run(tag, { actor: session.playerHandle }, signature.skill.cost);
  }

  if (signature.skill.target.kind === "entity") {
    const target = adjacentTarget();
    if (target === null) {
      return snapshot(`${signature.skill.name}：旁边没有可以打的东西`);
    }
    return run(tag, { actor: session.playerHandle, target }, signature.skill.cost);
  }

  return snapshot(`${signature.skill.name} 需要选目标：先用方向键`);
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

  const result = evaluate(envelope, session.link, session.handlers, currentView());
  if (!result.ok) {
    return snapshot(`规则出错：${result.diagnostics[0]?.message ?? "未知"}`);
  }

  const value = result.value;
  if (value.ok !== true) {
    return snapshot(value.reason ?? "不行");
  }

  const effects = collectEffects(result.value);
  for (const effect of effects) {
    session.store.submit(effect);
  }

  const speed = speedOfPlayer();
  const cost = effects.length > 0 ? costOf(DEFAULT_CLOCK, costKey, speed) : 0;
  session.lastEvents = session.store.step(cost);

  const rounds = cost === 0 ? "（零帧）" : `（${cost} 回合）`;
  return snapshot(`${skillName(tag)}${rounds}`);
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
      response.end(PAGE);
      return;
    }

    if (request.url === "/api/state") {
      sendJson(response, session === null ? { launcher: true, ...scanWorlds() } : snapshot(""));
      return;
    }

    if (request.method === "POST" && request.url === "/api/start") {
      const { id } = await readBody(request);
      try {
        const { byId } = collectPacks();
        session = buildSession(closureOf(String(id), byId));
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

    if (request.method === "POST" && request.url === "/api/skill") {
      const { tag } = await readBody(request);
      sendJson(response, useSkill(String(tag)));
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

const PAGE = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>新世界</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font: 14px/1.5 ui-monospace, Consolas, monospace;
         background: #14161a; color: #d7dae0; display: flex; justify-content: center; }
  main { padding: 24px; max-width: 900px; width: 100%; }
  h1 { font-size: 18px; font-weight: 600; color: #8ab4f8; margin: 0 0 4px; }
  .meta { color: #8b929e; margin-bottom: 16px; }
  .stage { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  #map { display: block; background: #0d0f13; border-radius: 8px;
         image-rendering: pixelated; width: 480px; height: 360px; }
  #hud { margin-top: 10px; color: #9aa3b2; }
  #hud b { color: #d7dae0; }
  .pad { display: grid; grid-template-columns: repeat(3, 56px); gap: 8px; }
  .pad button { height: 56px; font-size: 18px; background: #232733; color: #d7dae0;
                 border: 1px solid #333a4a; border-radius: 8px; cursor: pointer; }
  .pad button:hover { background: #2c3242; }
  .pad .empty { visibility: hidden; }
  #message { margin-top: 16px; min-height: 24px; color: #f0c674; }
  .skills { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .skills button { padding: 6px 10px; background: #232733; color: #d7dae0;
                   border: 1px solid #333a4a; border-radius: 6px; cursor: pointer; }
  .skills button:hover { background: #2c3242; }
  .skills .hint { color: #7f8794; font-size: 12px; align-self: center; }
  #events { margin-top: 16px; color: #7f8794; font-size: 12px; max-height: 160px; overflow: auto; }
  .world { display: flex; justify-content: space-between; align-items: center; gap: 16px;
           padding: 12px 14px; margin-bottom: 8px; background: #1b1f27;
           border: 1px solid #2a303c; border-radius: 8px; }
  .world .name { font-weight: 600; }
  .world .packs { color: #7f8794; font-size: 12px; }
  .world .error { color: #e06c75; font-size: 12px; }
  .world button { padding: 6px 14px; background: #2d3a52; color: #d7dae0;
                  border: 1px solid #3a4a66; border-radius: 6px; cursor: pointer; }
  .world button:hover { background: #364865; }
  .world.bad button { opacity: 0.4; cursor: not-allowed; }
</style>
<main>
  <h1>新世界</h1>
  <div class="meta" id="meta"></div>

  <div id="launcher">
    <div id="worlds"></div>
    <div id="errors"></div>
  </div>

  <div id="game" hidden>
    <div class="stage">
      <div>
        <canvas id="map" width="320" height="240"></canvas>
        <div id="hud"></div>
      </div>
      <div>
        <div class="pad">
          <div class="empty"></div><button data-dir="w">↑</button><div class="empty"></div>
          <button data-dir="a">←</button><button data-dir="s">↓</button><button data-dir="d">→</button>
        </div>
        <div id="skills" class="skills"></div>
        <div id="message"></div>
        <div id="events"></div>
      </div>
    </div>
  </div>
</main>
<script>
async function api(path, body) {
  const options = body === undefined ? {} : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
  return fetch(path, options).then((r) => r.json());
}

function renderLauncher(state) {
  document.getElementById('launcher').hidden = false;
  document.getElementById('game').hidden = true;
  document.getElementById('meta').textContent = '选择一个世界开始';

  const list = document.getElementById('worlds');
  list.innerHTML = '';
  for (const world of state.worlds) {
    const row = document.createElement('div');
    row.className = 'world' + (world.ok ? '' : ' bad');
    row.innerHTML =
      '<div><div class="name">' + world.id + ' <span class="packs">@' + world.version + '</span></div>' +
      '<div class="packs">' + (world.packs || []).join(' + ') + '</div>' +
      (world.ok ? '' : '<div class="error">' + world.error + '</div>') + '</div>';
    const button = document.createElement('button');
    button.textContent = '开始';
    button.disabled = !world.ok;
    button.addEventListener('click', () => start(world.id));
    row.appendChild(button);
    list.appendChild(row);
  }

  const errors = document.getElementById('errors');
  errors.innerHTML = '';
  for (const bad of state.errors || []) {
    const row = document.createElement('div');
    row.className = 'world bad';
    row.innerHTML = '<div><div class="name">' + bad.id + '</div><div class="error">' + bad.error + '</div></div>';
    errors.appendChild(row);
  }
}

async function start(id) {
  const state = await api('/api/start', { id });
  if (state.launcher) {
    renderLauncher(state);
    return;
  }
  showGame(state);
}

function showGame(state) {
  document.getElementById('launcher').hidden = true;
  document.getElementById('game').hidden = false;
  document.getElementById('meta').textContent = state.packs.join(' + ');
  render(state);
}

function render(state) {
  drawCommands(state);
  document.getElementById('hud').innerHTML =
    'HP <b>' + state.hud.hp + '/' + state.hud.hpMax + '</b>' +
    ' · 背包 <b>' + state.hud.inventory.length + '</b>' +
    ' · tick <b>' + state.tick + '</b>';
  document.getElementById('message').textContent = state.message;
  document.getElementById('events').textContent = state.events.join('\\n');

  const skills = document.getElementById('skills');
  skills.innerHTML = '';
  for (const skill of state.skills) {
    if (skill.tag === 'core.move') {
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = '移动：方向键';
      skills.appendChild(hint);
      continue;
    }
    const button = document.createElement('button');
    button.textContent = skill.name + ' (' + skill.cost + ')';
    button.addEventListener('click', () => useSkill(skill.tag));
    skills.appendChild(button);
  }
}

function drawCommands(state) {
  const canvas = document.getElementById('map');
  canvas.width = state.viewport.width;
  canvas.height = state.viewport.height;
  const ctx = canvas.getContext('2d');

  for (const command of state.commands) {
    if (command.kind === 'rect') {
      ctx.fillStyle = command.color;
      ctx.fillRect(command.x, command.y, command.w, command.h);
    } else if (command.kind === 'text') {
      ctx.fillStyle = command.color;
      ctx.font = command.size + 'px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(command.text, command.x, command.y);
    }
  }
}

async function act(dir) {
  render(await api('/api/act', { dir }));
}
async function useSkill(tag) {
  render(await api('/api/skill', { tag }));
}

document.querySelectorAll('button[data-dir]').forEach((button) => {
  button.addEventListener('click', () => act(button.dataset.dir));
});
window.addEventListener('keydown', (event) => {
  if (!document.getElementById('game').hidden && ['w','a','s','d','e','r'].includes(event.key)) {
    act(event.key);
  }
});

api('/api/state').then((state) => (state.launcher ? renderLauncher(state) : showGame(state)));
</script>
</html>`;
