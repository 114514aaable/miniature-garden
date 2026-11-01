// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 两个页面：启动器和游戏。
 *
 * 为什么拆开：它们的状态完全无关——启动器只管「列出世界、看结构」，
 * 游戏只管「画一局」。挤在一个页面里，任何一边出错都会白屏，
 * 而且互相污染（切回启动器要清理游戏状态、游戏要忽略启动器面板）。
 *
 * 两个页面共享同一套 API，但谁也不 import 谁。
 */

const CSS = `
  :root { color-scheme: dark; }
  body { margin: 0; font: 14px/1.5 ui-monospace, Consolas, monospace;
         background: #14161a; color: #d7dae0; display: flex; justify-content: center; }
  main { padding: 24px; max-width: 900px; width: 100%; }
  h1 { font-size: 18px; font-weight: 600; color: #8ab4f8; margin: 0 0 4px; }
  .meta { color: #8b929e; margin-bottom: 16px; }
  button { padding: 6px 12px; background: #232733; color: #d7dae0;
           border: 1px solid #333a4a; border-radius: 6px; cursor: pointer; }
  button:hover { background: #2c3242; }
  .world { display: flex; justify-content: space-between; align-items: center; gap: 16px;
           padding: 12px 14px; margin-bottom: 8px; background: #1b1f27;
           border: 1px solid #2a303c; border-radius: 8px; }
  .world .name { font-weight: 600; }
  .world .packs { color: #7f8794; font-size: 12px; }
  .world .error { color: #e06c75; font-size: 12px; }
  .world.bad button { opacity: 0.4; cursor: not-allowed; }
  .stage { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  #map { display: block; background: #0d0f13; border-radius: 8px;
         image-rendering: pixelated; width: 480px; height: 360px; cursor: crosshair; }
  #hud { margin-top: 10px; color: #9aa3b2; }
  #hud b { color: #d7dae0; }
  .pad { display: grid; grid-template-columns: repeat(3, 56px); gap: 8px; }
  .pad button { height: 56px; font-size: 18px; }
  .pad .empty { visibility: hidden; }
  .skills { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .skills .hint { color: #7f8794; font-size: 12px; align-self: center; }
  #message { margin-top: 16px; min-height: 24px; color: #f0c674; }
  #devpanel { margin-top: 12px; color: #7f8794; font-size: 12px; }
  #devpanel summary { cursor: pointer; }
  #devlog, #debug { margin: 8px 0 0; padding: 8px; max-height: 200px; overflow: auto; color: #8b929e;
                    background: #0f1116; border: 1px solid #232733; border-radius: 6px; white-space: pre; }
  #graphpanel[hidden] { display: none; }
  #graphpanel { position: fixed; inset: 40px 60px; z-index: 20; display: flex; flex-direction: column;
                background: #10131a; border: 1px solid #2a303c; border-radius: 10px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6); padding: 12px 16px; }
  .graphbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .graphbar span { color: #8ab4f8; font-weight: 600; }
  #graph { margin: 0; flex: 1; overflow: auto; color: #9aa3b2; font-size: 12px; white-space: pre; }
  #errbar { position: sticky; top: 0; z-index: 30; margin-bottom: 12px; padding: 8px 12px;
            background: #3a1d22; color: #ff9aa2; border: 1px solid #5c2a32; border-radius: 6px;
            font-size: 12px; white-space: pre-wrap; }
  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  a { color: #8ab4f8; }
`;

const ERRORS = `
window.addEventListener('error', (event) => {
  const bar = document.getElementById('errbar');
  if (!bar) return;
  bar.hidden = false;
  bar.textContent = '页面出错：' + (event.message || '未知') + (event.filename ? ' @' + event.lineno : '');
});
window.addEventListener('unhandledrejection', (event) => {
  const bar = document.getElementById('errbar');
  if (!bar) return;
  bar.hidden = false;
  bar.textContent = '未处理的错误：' + (event.reason && event.reason.message ? event.reason.message : event.reason);
});
async function api(path, body) {
  const options = body === undefined ? {} : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
  return fetch(path, options).then((response) => response.json());
}
`;

/** 启动器：列世界、看结构、跳转到 /game。 */
/** 启动器：世界列表 + 结构树（组可整体开关）。 */
export const LAUNCHER_PAGE = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>新世界 · 启动器</title>
<style>${CSS}</style>
<style>
  #graph { white-space: normal; }
  .tree details { margin-left: 14px; }
  .tree summary { cursor: pointer; color: #9aa3b2; padding: 2px 0; }
  .tree summary b { color: #d7dae0; }
  .tree .leaf { margin-left: 22px; padding: 2px 0; color: #8b929e; display: flex; gap: 6px; align-items: baseline; }
  .tree .leaf .id { color: #5f6b7a; font-size: 11px; }
  .tree .leaf .desc { color: #6f7a89; font-size: 11px; }
  .tree label.group { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
</style>
<main>
  <div id="errbar" hidden></div>
  <h1>{{app.title}}</h1>
  <div class="meta" id="meta">{{launcher.pick}}</div>
  <div id="worlds"></div>
  <div id="errors"></div>
</main>

<div id="graphpanel" hidden>
  <div class="graphbar">
    <span id="graphtitle">{{launcher.structure_title}}</span>
    <button id="graphclose">{{launcher.close}}</button>
  </div>
  <div class="tree" id="tree"></div>
  <div style="margin-top:10px; display:flex; gap:10px; align-items:center">
    <button id="graphstart">{{launcher.start_this}}</button>
    <span class="meta" id="offcount" style="margin:0"></span>
  </div>
</div>

<script>
${ERRORS}

const KIND_ORDER = [
  ['rule', '规则'], ['component', '组件'], ['template', '模板'],
  ['terrain', '地形'], ['space', '空间'], ['entity', '实体'], ['world', '世界'],
];

function render(state) {
  const list = document.getElementById('worlds');
  list.textContent = '';

  for (const world of state.worlds) {
    const row = document.createElement('div');
    row.className = 'world' + (world.ok ? '' : ' bad');

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = world.id + ' @' + world.version;
    info.appendChild(name);
    const packs = document.createElement('div');
    packs.className = 'packs';
    packs.textContent = (world.packs || []).join(' + ');
    info.appendChild(packs);
    if (!world.ok) {
      const error = document.createElement('div');
      error.className = 'error';
      error.textContent = world.error;
      info.appendChild(error);
    }
    row.appendChild(info);

    const actions = document.createElement('div');
    const startButton = document.createElement('button');
    startButton.textContent = '{{launcher.start}}';
    startButton.disabled = !world.ok;
    startButton.addEventListener('click', () => {
      location.href = '/game?world=' + encodeURIComponent(world.id);
    });
    actions.appendChild(startButton);

    const graphButton = document.createElement('button');
    graphButton.textContent = '{{launcher.structure}}';
    graphButton.style.marginLeft = '8px';
    graphButton.addEventListener('click', () => showGraph(world.id));
    actions.appendChild(graphButton);

    row.appendChild(actions);
    list.appendChild(row);
  }

  const errors = document.getElementById('errors');
  errors.textContent = '';
  for (const bad of state.errors || []) {
    const row = document.createElement('div');
    row.className = 'world bad';
    row.innerHTML = '<div><div class="name"></div><div class="error"></div></div>';
    row.querySelector('.name').textContent = bad.id;
    row.querySelector('.error').textContent = bad.error;
    errors.appendChild(row);
  }
}

let currentWorld = null;

async function showGraph(id) {
  currentWorld = id;
  const panel = document.getElementById('graphpanel');
  const tree = document.getElementById('tree');
  document.getElementById('graphtitle').textContent = '{{launcher.structure_title}} · ' + id;
  panel.hidden = false;
  tree.textContent = '{{launcher.reading}}';

  let result;
  try {
    result = await api('/api/graph', { id });
  } catch (error) {
    tree.textContent = '请求失败：' + error;
    return;
  }
  if (!result || result.ok !== true) {
    tree.textContent = '读不出来：' + (result && result.error ? result.error : '未知错误');
    return;
  }

  tree.textContent = '';
  buildTree(tree, result.nodes);
  updateOffCount();
}

/** 包 → 类别 → 条目；规则和规则组带勾选。 */
function buildTree(root, nodes) {
  const packs = new Map();
  for (const node of nodes) {
    if (!packs.has(node.origin)) packs.set(node.origin, []);
    packs.get(node.origin).push(node);
  }

  for (const [origin, list] of packs) {
    const packBox = document.createElement('details');
    packBox.open = true;
    const summary = document.createElement('summary');
    summary.innerHTML = '<b>' + origin + '</b> · ' + list.length + ' 项';
    packBox.appendChild(summary);

    const byKind = new Map();
    for (const node of list) {
      if (!byKind.has(node.kind)) byKind.set(node.kind, []);
      byKind.get(node.kind).push(node);
    }

    for (const [kind, title] of KIND_ORDER) {
      const items = byKind.get(kind);
      if (!items || items.length === 0) continue;
      packBox.appendChild(kindGroup(kind, title, items));
    }

    root.appendChild(packBox);
  }
}

function kindGroup(kind, title, items) {
  const box = document.createElement('details');
  box.open = kind === 'rule';

  const summary = document.createElement('summary');
  if (kind === 'rule') {
    // 组开关：整组一起启停
    const label = document.createElement('label');
    label.className = 'group';
    const group = document.createElement('input');
    group.type = 'checkbox';
    group.checked = true;
    group.dataset.group = kind;
    group.addEventListener('click', (event) => event.stopPropagation());
    group.addEventListener('change', () => {
      for (const input of box.querySelectorAll('input[data-rule]')) {
        input.checked = group.checked;
      }
      updateOffCount();
    });
    label.appendChild(group);
    label.appendChild(document.createTextNode(' ' + title + ' (' + items.length + ')'));
    summary.appendChild(label);
  } else {
    summary.textContent = title + ' (' + items.length + ')';
  }
  box.appendChild(summary);

  for (const node of items.sort((a, b) => (a.label < b.label ? -1 : 1))) {
    const leaf = document.createElement('div');
    leaf.className = 'leaf';

    if (kind === 'rule') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = true;
      input.dataset.rule = node.label;
      input.addEventListener('change', updateOffCount);
      leaf.appendChild(input);
    }

    const name = document.createElement('span');
    name.textContent = node.display || node.label;
    leaf.appendChild(name);

    const id = document.createElement('span');
    id.className = 'id';
    id.textContent = node.label !== node.display ? node.label : '';
    leaf.appendChild(id);

    if (node.description) {
      const desc = document.createElement('span');
      desc.className = 'desc';
      desc.textContent = '— ' + node.description;
      leaf.appendChild(desc);
    }

    box.appendChild(leaf);
  }

  return box;
}

function disabledRules() {
  return Array.from(document.querySelectorAll('input[data-rule]'))
    .filter((input) => !input.checked)
    .map((input) => input.dataset.rule);
}

function updateOffCount() {
  const off = disabledRules();
  document.getElementById('offcount').textContent = off.length === 0 ? '' : '关掉 ' + off.length + ' 条规则';
}

document.getElementById('graphstart').addEventListener('click', () => {
  const off = disabledRules();
  const query = '/game?world=' + encodeURIComponent(currentWorld) +
    (off.length > 0 ? '&off=' + encodeURIComponent(off.join(',')) : '');
  location.href = query;
});

document.getElementById('graphclose').addEventListener('click', () => {
  document.getElementById('graphpanel').hidden = true;
});

api('/api/worlds').then((state) => {
  document.getElementById('meta').textContent = '{{launcher.pick}}';
  render(state);
});
</script>
</html>`;

/** 游戏：全屏地图 + HUD 叠加层。世界由 ?world= 指定。 */
export const GAME_PAGE = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>新世界</title>
<style>${CSS}</style>
<style>
  body { overflow: hidden; }
  #map { position: fixed; inset: 0; width: 100vw; height: 100vh; border-radius: 0; }
  #hud { position: fixed; inset: 0; pointer-events: none; }
  #hud > * { pointer-events: auto; }
  #topbar { position: absolute; top: 10px; left: 10px; display: flex; gap: 8px; align-items: center;
            padding: 4px 8px; background: rgba(16,19,26,0.75); border-radius: 8px; }
  #status { position: absolute; top: 10px; right: 10px; padding: 6px 10px;
            background: rgba(16,19,26,0.75); border-radius: 8px; }
  #skills { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
            display: flex; gap: 6px; margin: 0; }
  #skills button { min-width: 64px; height: 52px; }
  #skills .hint { display: none; }
  #message { position: absolute; bottom: 78px; left: 50%; transform: translateX(-50%);
             margin: 0; padding: 4px 10px; background: rgba(16,19,26,0.7); border-radius: 6px;
             white-space: nowrap; }
  #logbox { position: absolute; bottom: 14px; left: 10px; width: 340px; max-height: 180px;
            overflow: hidden; padding: 6px 10px; background: rgba(16,19,26,0.7);
            border-radius: 8px; color: #9aa3b2; font-size: 12px; }
  #tooltip { position: fixed; z-index: 30; pointer-events: none; max-width: 320px;
             padding: 6px 10px; background: rgba(10,12,16,0.92); border: 1px solid #2a303c;
             border-radius: 6px; color: #c7cdd6; font-size: 12px; white-space: pre-wrap; }
  #devpanel { position: absolute; top: 10px; right: 10px; max-width: 460px; }
  #devpanel[open] { background: rgba(16,19,26,0.92); padding: 8px 10px; border-radius: 8px; }
</style>

<canvas id="map"></canvas>

<div id="hud">
  <div id="errbar" hidden></div>

  <div id="topbar">
    <a href="/">{{game.back}}</a>
    <button id="savebtn">{{game.save}}</button>
    <button id="loadbtn">{{game.load}}</button>
    <span class="meta" id="meta" style="margin:0"></span>
  </div>

  <div id="status"></div>

  <div id="skills"></div>
  <div id="message"></div>
  <div id="logbox"></div>

  <div id="settings" hidden></div>
  <div id="tooltip" hidden></div>

  <details id="devpanel">
    <summary>{{game.devlog}}</summary>
    <pre id="debug"></pre>
    <pre id="devlog"></pre>
  </details>
</div>

<script>
// 模块脚本加载失败时，这段（经典脚本）还能报错。
window.addEventListener('error', function (event) {
  var bar = document.getElementById('errbar');
  if (!bar) return;
  bar.hidden = false;
  bar.textContent = '页面出错：' + (event.message || '脚本加载失败') +
    (event.filename ? '  @' + event.filename + ':' + event.lineno : '');
});
</script>

<script type="module">
import { attach } from '/web/systems/render/browser.js';
import { row, col, text, button, toggle, modal } from '/web/systems/ui/spec.js';
import { mount, render as renderNode } from '/web/systems/ui/dom.js';

${ERRORS}

const params = new URLSearchParams(location.search);
const worldId = params.get('world');
const off = (params.get('off') || '').split(',').filter(Boolean);

let renderer = null;
let aimTimer = 0;
let tile = 32;

function formatDebug(debug) {
  if (!debug) return '';
  const lines = [];
  lines.push('tick ' + debug.tick + '   玩家下次可动 ' + debug.playerReadyAt);
  lines.push('调度顺序：' + debug.upcoming.map((d) => '#' + d.handle + '@' + d.tick).join('  '));
  for (const actor of debug.actors) {
    lines.push('  #' + actor.handle + ' ' + actor.template + ' @(' + actor.x + ',' + actor.y + ') 下次 ' + actor.readyAt);
    if (actor.intent) {
      const tiles = actor.intent.tiles.map((t) => '(' + t.x + ',' + t.y + ')').join(' ');
      lines.push('      意图：打 ' + tiles + '  伤害 ' + actor.intent.damage + '  结算 @' + actor.intent.resolveAt);
    }
  }
  return lines.join('\\n');
}

function render(state) {
  if (renderer === null) {
    renderer = attach(document.getElementById('map'), { tile: state.tile });
  }
  tile = state.tile;
  renderer.setState(state);

  document.getElementById('status').innerHTML =
    'HP <b>' + state.hud.hp + '/' + state.hud.hpMax + '</b>' +
    ' · 背包 <b>' + state.hud.inventory.length + '</b>' +
    ' · tick <b>' + state.tick + '</b><br>' +
    (state.hud.readyAt > state.tick
      ? '<span style="color:#f0c674">恢复中 还要 ' + (state.hud.readyAt - state.tick) + ' 回合</span>'
      : '<span style="color:#98c379">可以行动</span>');

  document.getElementById('meta').textContent = state.packs.join(' + ');
  document.getElementById('message').textContent = state.message;
  document.getElementById('logbox').textContent = (state.events || []).slice(-5).join('\\n');
  document.getElementById('devlog').textContent = (state.devlog || []).join('\\n');
  document.getElementById('debug').textContent = formatDebug(state.debug);

  const skillButtons = state.skills
    .filter((skill) => skill.tag !== 'core.move')
    .map((skill) => button(skill.name + ' ' + skill.cost, () => useSkill(skill.tag)));
  mount(document.getElementById('skills'), row({ gap: 6, align: 'center' }, ...skillButtons));
}

async function act(dir) {
  render(await api('/api/act', { dir }));
}
async function useSkill(tag, x, y) {
  const body = x === undefined ? { tag } : { tag, x, y };
  render(await api('/api/skill', body));
}

function cellAt(event) {
  const canvas = document.getElementById('map');
  const rect = canvas.getBoundingClientRect();
  return renderer.cellAt(event.clientX - rect.left, event.clientY - rect.top);
}

document.getElementById('map').addEventListener('mousemove', (event) => {
  if (renderer === null) return;
  const now = Date.now();
  if (now - aimTimer < 40) return;
  aimTimer = now;

  const cell = cellAt(event);
  api('/api/aim', { tag: 'core.attack', x: cell.x, y: cell.y }).then((result) => {
    renderer.setAim(result.ok ? result.cells : []);
  });
  api('/api/inspect', { x: cell.x, y: cell.y }).then((info) => {
    showTooltip(info, event.clientX, event.clientY);
  });
});

/** 信息槽：鼠标附近显示这一格有什么。以后加字段只改这里。 */
function showTooltip(info, clientX, clientY) {
  const tip = document.getElementById('tooltip');
  if (!info || info.ok !== true) {
    tip.hidden = true;
    return;
  }

  const lines = ['(' + info.cell.x + ',' + info.cell.y + ') ' + info.terrain.name];
  for (const entity of info.entities) {
    let line = entity.name;
    if (entity.hp) line += '  ' + entity.hp.cur + '/' + entity.hp.max;
    if (entity.intent) line += '  意图 ' + entity.intent.count + ' 格 @' + entity.intent.resolveAt;
    lines.push(line);
    if (entity.description) lines.push('  ' + entity.description);
  }

  tip.textContent = lines.join('\\n');
  tip.style.left = Math.min(clientX + 16, window.innerWidth - 340) + 'px';
  tip.style.top = Math.min(clientY + 16, window.innerHeight - 120) + 'px';
  tip.hidden = false;
}

document.getElementById('map').addEventListener('mouseleave', () => {
  document.getElementById('tooltip').hidden = true;
  if (renderer !== null) renderer.setAim([]);
});

document.getElementById('map').addEventListener('click', (event) => {
  if (renderer === null) return;
  const cell = cellAt(event);
  useSkill('core.attack', cell.x, cell.y);
});

const settings = {
  speed: Number(localStorage.getItem('nw.speed') || '10'),
  devlog: localStorage.getItem('nw.devlog') !== '0',
};

function applySettings() {
  if (renderer !== null) renderer.setVisualSpeed(settings.speed);
  document.getElementById('devpanel').style.display = settings.devlog ? '' : 'none';
  localStorage.setItem('nw.speed', String(settings.speed));
  localStorage.setItem('nw.devlog', settings.devlog ? '1' : '0');
}

function closeSettings() {
  const box = document.getElementById('settings');
  box.hidden = true;
  box.textContent = '';
}

function openSettings() {
  const speeds = [5, 10, 20].map((value) =>
    button((settings.speed === value ? '● ' : '') + value + ' 格/秒', () => {
      settings.speed = value;
      applySettings();
      openSettings();
    }),
  );

  const body = col({ gap: 10 },
    row({ gap: 8, align: 'center' }, text('动画速度'), ...speeds),
    toggle('显示开发日志', settings.devlog, (next) => {
      settings.devlog = next;
      applySettings();
      openSettings();
    }),
    row({ gap: 8, justify: 'end' }, button('关闭', closeSettings)),
  );

  const box = document.getElementById('settings');
  box.hidden = false;
  box.textContent = '';
  box.appendChild(renderNode(modal(body, { title: '设置' })));
}

document.getElementById('savebtn').addEventListener('click', async () => { render(await api('/api/save', {})); });
document.getElementById('loadbtn').addEventListener('click', async () => { render(await api('/api/load', {})); });

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const box = document.getElementById('settings');
    if (box.hidden) openSettings(); else closeSettings();
    return;
  }
  if (!document.getElementById('settings').hidden) return;
  if (['w', 'a', 's', 'd', 'e', 'r'].includes(event.key)) act(event.key);
});

(async () => {
  if (!worldId) {
    document.getElementById('errbar').hidden = false;
    document.getElementById('errbar').textContent = '没有指定世界：请从启动器进入。';
    return;
  }
  const state = await api('/api/start', { id: worldId, off });
  if (!state || state.launcher) {
    document.getElementById('errbar').hidden = false;
    document.getElementById('errbar').textContent = '世界载入失败：' + (state && state.errors && state.errors[0] ? state.errors[0].error : '未知');
    return;
  }
  render(state);
  applySettings();
})();
</script>
</html>`;

/** 结构面板用的元素在启动器页里，这里只导出页面本身。 */
export const PAGES = { LAUNCHER_PAGE, GAME_PAGE };
