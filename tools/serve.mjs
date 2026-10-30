// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 本地调试台：浏览器里点按钮，世界走一步。
 *
 * 用法：
 *   node tools/serve.mjs worlds/official.base worlds/official.normal
 *   然后打开 http://127.0.0.1:8787
 *
 * 它是宿主侧工具，不属于内核：内核只接收信封、产出效果。
 * 这里做的事和 demo-text 一样，只是把「输入」换成了按钮。
 */

import { createServer } from "node:http";

import { readPack } from "./pack-reader.mjs";

import { collectEffects } from "../engine/core/src/event/effects.ts";
import { evaluate } from "../engine/core/src/event/evaluate.ts";
import { Registry } from "../engine/core/src/event/registry.ts";
import { createWorldView } from "../engine/core/src/event/view.ts";
import { costOf, DEFAULT_CLOCK } from "../engine/core/src/rules/clock.ts";
import { loadWorld } from "../engine/core/src/pack/load.ts";
import { mergePacks } from "../engine/core/src/pack/merge.ts";
import { orderPacks } from "../engine/core/src/pack/order.ts";
import { attackHandler, attackSignature } from "../engine/core/src/rules/attack.ts";
import { moveHandler, moveSignature } from "../engine/core/src/rules/move.ts";
import { dropHandler, dropSignature, takeHandler, takeSignature } from "../engine/core/src/rules/inventory.ts";
import { Store } from "../engine/core/src/store.ts";

const GLYPH = { pc: "@", npc_salt: "N", prop_crate: "o", item_lamp: "i" };
const TERRAIN_GLYPH = { 0: " ", 1: "#", 2: "~", 3: "." };
const DIRECTIONS = {
  w: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
};

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("用法：node tools/serve.mjs <包目录> [更多包目录...]");
  process.exit(2);
}

const contents = dirs.map(readPack);
const byId = new Map(contents.map((content) => [content.pack.id, content]));
const ordered = orderPacks(contents.map((content) => content.pack)).map((pack) => byId.get(pack.id));
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

/** 玩家的句柄：从 spawn 的事件里按模板找。 */
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

/** 技能表：UI 只读这个，不认识任何实现。 */
const skills = link.signatures
  .filter((signature) => signature.skill !== undefined)
  .map((signature) => ({ tag: signature.tag, ...signature.skill }));

let lastEvents = [];

function snapshot(message) {
  const space = loaded.spaces[0];
  const glyphAt = new Map();

  for (let y = 0; y < space.height; y++) {
    for (let x = 0; x < space.width; x++) {
      const occupants = space.occupantsAt({ x, y });
      if (occupants.length > 0) {
        const template = store.entity(occupants[0]).template;
        glyphAt.set(`${x},${y}`, GLYPH[template] ?? "?");
      } else {
        glyphAt.set(`${x},${y}`, TERRAIN_GLYPH[space.terrainAt({ x, y })] ?? "?");
      }
    }
  }

  const rows = [];
  for (let y = 0; y < space.height; y++) {
    let row = "";
    for (let x = 0; x < space.width; x++) {
      row += glyphAt.get(`${x},${y}`);
    }
    rows.push(row);
  }

  return {
    width: space.width,
    height: space.height,
    rows,
    tick: store.now(),
    hash: store.headHash,
    message,
    rules: loaded.rules,
    packs: ordered.map((content) => `${content.pack.id}@${content.pack.version}`),
    worldHash: loaded.hash,
    skills: skills.map((skill) => ({
      tag: skill.tag,
      name: skill.name,
      cost: skill.cost,
      target: skill.target.kind,
    })),
    events: lastEvents.map((entry) => `#${entry.id} ${entry.kind} ${JSON.stringify(entry.data)}`),
  };
}

function act(command) {
  if (playerHandle === null) {
    return snapshot("这个世界没有玩家角色");
  }

  // 方向键 → 移动
  const direction = DIRECTIONS[command];
  if (direction !== undefined) {
    const position = store.entity(playerHandle).pos;
    return run(
      "core.move",
      {
        handle: playerHandle,
        space: store.entity(playerHandle).space,
        x: position.x + direction.dx,
        y: position.y + direction.dy,
      },
      "move",
      (now) => `走到 (${now.x}, ${now.y})`,
    );
  }

  // e → 捡起脚下 / 同格的东西
  if (command === "e") {
    return run("core.take", { actor: playerHandle }, "take", (now) => `捡起（${now.x}, ${now.y}）`);
  }

  // r → 把背包里第一个东西放在脚下
  if (command === "r") {
    const position = store.entity(playerHandle).pos;
    return run(
      "core.drop",
      { actor: playerHandle, x: position.x, y: position.y },
      "drop",
      (now) => `放下（${now.x}, ${now.y}）`,
    );
  }

  return snapshot("不懂这个指令（w/a/s/d 走，e 捡，r 放）");
}

/** 用技能表里的技能：自己 / 相邻实体，选格子的以后再说。 */
function useSkill(tag) {
  const sym = link.tags.get(tag);
  const signature = sym === undefined ? undefined : link.signatures[sym];
  if (signature === undefined || signature.skill === undefined) {
    return snapshot("没有这个技能");
  }

  if (signature.skill.target.kind === "self") {
    return run(tag, { actor: playerHandle }, signature.skill.cost, () => `用了 ${signature.skill.name}`);
  }

  if (signature.skill.target.kind === "entity") {
    const target = adjacentTarget();
    if (target === null) {
      return snapshot(`${signature.skill.name}：旁边没有可以打的东西`);
    }
    return run(tag, { actor: playerHandle, target }, signature.skill.cost, () => `对 ${target} 用了 ${signature.skill.name}`);
  }

  return snapshot(`${signature.skill.name} 需要选目标：先用方向键`);
}

/** 相邻的、有生命值的东西。v0 只找四个正方向。 */
function adjacentTarget() {
  const self = store.entity(playerHandle);
  if (self.pos === null || self.space === null) return null;

  const view = createWorldView(loaded.spaces, {
    tick: store.now(),
    entities: { get: (handle) => store.entity(handle) },
    terrains: loaded.terrains,
    templates: loaded.templates,
  });

  const space = view.space(self.space);
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const cell = { x: self.pos.x + dx, y: self.pos.y + dy };
    if (!space.passableAt(cell)) continue;
    for (const handle of space.occupantsAt(cell)) {
      if (handle === playerHandle) continue;
      if (view.entity(handle).components["core.health"] !== undefined) {
        return handle;
      }
    }
  }
  return null;
}

/** 跑一次信封：求值、收效果、按成本推进。 */
function run(tag, params, costKey, describe) {
  const envelope = { id: store.now() + 1, tag, params };

  const view = createWorldView(loaded.spaces, {
    tick: store.now(),
    entities: { get: (handle) => store.entity(handle) },
    terrains: loaded.terrains,
    templates: loaded.templates,
  });

  const result = evaluate(envelope, link, handlers, view);
  if (!result.ok) {
    return snapshot(`规则出错：${result.diagnostics[0]?.message ?? "未知"}`);
  }

  const value = result.value;
  if (value.ok !== true) {
    return snapshot(value.reason ?? "不行");
  }

  const effects = collectEffects(result.value);
  for (const effect of effects) {
    store.submit(effect);
  }

  const speed = speedOfPlayer();
  const cost = effects.length > 0 ? costOf(DEFAULT_CLOCK, costKey, speed) : 0;
  lastEvents = store.step(cost);

  const now = store.entity(playerHandle).pos ?? { x: 0, y: 0 };
  const rounds = cost === 0 ? "（零帧）" : `（${cost} 回合）`;
  return snapshot(`${describe(now)}${rounds}`);
}

/** 玩家的速度。读的是合并后的组件，所以模板里写的也算。 */
function speedOfPlayer() {
  const view = createWorldView(loaded.spaces, {
    tick: store.now(),
    entities: { get: (handle) => store.entity(handle) },
    templates: loaded.templates,
  });
  const stats = view.entity(playerHandle).components["core.stats"];
  if (typeof stats !== "object" || stats === null || Array.isArray(stats)) {
    return 0;
  }
  const speed = (stats).speed;
  return typeof speed === "number" ? speed : 0;
}

const PAGE = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>新世界 · 调试台</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font: 14px/1.5 ui-monospace, Consolas, monospace;
         background: #14161a; color: #d7dae0; display: flex; justify-content: center; }
  main { padding: 24px; max-width: 900px; width: 100%; }
  h1 { font-size: 16px; font-weight: 600; color: #8ab4f8; margin: 0 0 4px; }
  .meta { color: #8b929e; margin-bottom: 16px; }
  .stage { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  #map { background: #0d0f13; padding: 12px; border-radius: 8px; line-height: 1.2; }
  #map div { white-space: pre; letter-spacing: 2px; }
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
</style>
<main>
  <h1>新世界 · 调试台</h1>
  <div class="meta" id="meta"></div>
  <div class="stage">
    <div id="map"></div>
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
</main>
<script>
async function act(dir) {
  const state = await fetch('/api/act', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir }),
  }).then((r) => r.json());
  render(state);
}
function render(state) {
  document.getElementById('map').innerHTML =
    state.rows.map((row) => '<div>' + row.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>').join('');
  document.getElementById('meta').textContent =
    state.packs.join(' + ') + ' · tick ' + state.tick + ' · 链头 ' + state.hash;
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
async function useSkill(tag) {
  const state = await fetch('/api/skill', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tag }),
  }).then((r) => r.json());
  render(state);
}
document.querySelectorAll('button[data-dir]').forEach((button) => {
  button.addEventListener('click', () => act(button.dataset.dir));
});
window.addEventListener('keydown', (event) => {
  if (['w', 'a', 's', 'd', 'e', 'r'].includes(event.key)) act(event.key);
});
fetch('/api/state').then((r) => r.json()).then(render);
</script>
</html>`;

const server = createServer((request, response) => {
  if (request.method === "GET" && (request.url === "/" || request.url === "/index.html")) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(PAGE);
    return;
  }

  if (request.method === "GET" && request.url === "/api/state") {
    sendJson(response, snapshot("点方向键，或者按 w/a/s/d"));
    return;
  }

  if (request.method === "POST" && request.url === "/api/act") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        const { dir } = JSON.parse(body || "{}");
        sendJson(response, act(String(dir)));
      } catch (error) {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ rows: ["错误"], message: String(error) }));
      }
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/skill") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        const { tag } = JSON.parse(body || "{}");
        sendJson(response, useSkill(String(tag)));
      } catch (error) {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ rows: ["错误"], message: String(error) }));
      }
    });
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("not found");
});

function sendJson(response, data) {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

const port = Number(process.env.PORT ?? 8787);
server.listen(port, "127.0.0.1", () => {
  console.log(`调试台：http://127.0.0.1:${port}`);
  console.log(`世界：${ordered.map((content) => content.pack.id).join(" + ")}`);
});
