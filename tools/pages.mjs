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
export const LAUNCHER_PAGE = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>新世界 · 启动器</title>
<style>${CSS}</style>
<main>
  <div id="errbar" hidden></div>
  <h1>新世界</h1>
  <div class="meta" id="meta">选择一个世界开始</div>
  <div id="worlds"></div>
  <div id="errors"></div>
</main>

<div id="graphpanel" hidden>
  <div class="graphbar">
    <span id="graphtitle">世界结构</span>
    <button id="graphclose">关闭</button>
  </div>
  <div id="rules"></div>
  <button id="graphstart" style="margin-top:8px">用这个配置开始</button>
  <pre id="graph"></pre>
</div>

<script>
${ERRORS}

const KIND_ORDER = [
  ['world', '世界'], ['rule', '规则'], ['component', '组件'],
  ['template', '模板'], ['terrain', '地形'], ['space', '空间'], ['entity', '实体'],
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
    startButton.textContent = '开始';
    startButton.disabled = !world.ok;
    startButton.addEventListener('click', () => {
      location.href = '/game?world=' + encodeURIComponent(world.id);
    });
    actions.appendChild(startButton);

    const graphButton = document.createElement('button');
    graphButton.textContent = '结构';
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

async function showGraph(id) {
  const panel = document.getElementById('graphpanel');
  const box = document.getElementById('graph');
  document.getElementById('graphtitle').textContent = '世界结构 · ' + id;
  panel.hidden = false;
  box.textContent = '读取结构…';

  let result;
  try {
    result = await api('/api/graph', { id });
  } catch (error) {
    box.textContent = '请求失败：' + error;
    return;
  }

  if (!result || result.ok !== true) {
    box.textContent = '读不出来：' + (result && result.error ? result.error : '未知错误');
    return;
  }

  renderRuleToggles(id, result.nodes);

  const lines = [];
  for (const [kind, title] of KIND_ORDER) {
    const nodes = result.nodes.filter((node) => node.kind === kind).sort((a, b) => (a.label < b.label ? -1 : 1));
    if (nodes.length === 0) continue;
    lines.push('── ' + title + ' (' + nodes.length + ') ──');
    for (const node of nodes) {
      const used = node.usedBy.length === 0 ? '—' : '被 ' + node.usedBy.length + ' 处引用';
      lines.push('  ' + String(node.label).padEnd(22, ' ') + ' ' + String(node.origin).padEnd(18, ' ') + used);
    }
    lines.push('');
  }
  box.textContent = lines.join('\\n');
}

/** 规则开关：勾上=启用，取消=启动时不注册。 */
function renderRuleToggles(worldId, nodes) {
  const box = document.getElementById('rules');
  box.textContent = '';
  const title = document.createElement('div');
  title.textContent = '规则（取消勾选 = 本局不加载）';
  title.style.color = '#8b929e';
  title.style.marginBottom = '6px';
  box.appendChild(title);

  for (const node of nodes.filter((item) => item.kind === 'rule').sort((a, b) => (a.label < b.label ? -1 : 1))) {
    const row = document.createElement('label');
    row.style.display = 'block';
    row.style.cursor = 'pointer';
    const box2 = document.createElement('input');
    box2.type = 'checkbox';
    box2.checked = true;
    box2.value = node.label;
    box2.dataset.rule = node.label;
    row.appendChild(box2);
    row.appendChild(document.createTextNode(' ' + node.label));
    box.appendChild(row);
  }

  document.getElementById('graphstart').onclick = () => {
    const disabled = [...box.querySelectorAll('input[data-rule]')]
      .filter((input) => !input.checked)
      .map((input) => input.value);
    const query = '/game?world=' + encodeURIComponent(worldId) +
      (disabled.length > 0 ? '&off=' + encodeURIComponent(disabled.join(',')) : '');
    location.href = query;
  };
}

document.getElementById('graphclose').addEventListener('click', () => {
  document.getElementById('graphpanel').hidden = true;
});

api('/api/worlds').then((state) => {
  document.getElementById('meta').textContent = '选择一个世界开始';
  render(state);
});
</script>
</html>`;

/** 游戏：canvas + HUD + 技能。世界由 ?world= 指定。 */
export const GAME_PAGE = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>新世界</title>
<style>${CSS}</style>
<main>
  <div id="errbar" hidden></div>
  <div class="topbar">
    <a href="/">← 启动器</a>
    <span class="meta" id="meta"></span>
  </div>

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
      <details id="devpanel">
        <summary>开发日志</summary>
        <pre id="debug"></pre>
        <pre id="devlog"></pre>
      </details>
    </div>
  </div>
</main>

<script type="module">
import { attach } from '/web/systems/render/browser.js';

${ERRORS}

const params = new URLSearchParams(location.search);
const worldId = params.get('world');
const off = (params.get('off') || '').split(',').filter(Boolean);
let renderer = null;
let lastTile = 40;
let aimTimer = 0;

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
  lastTile = state.tile;
  renderer.setState(state);

  document.getElementById('hud').innerHTML =
    'HP <b>' + state.hud.hp + '/' + state.hud.hpMax + '</b>' +
    ' · 背包 <b>' + state.hud.inventory.length + '</b>' +
    ' · tick <b>' + state.tick + '</b>' +
    (state.hud.readyAt > state.tick
      ? ' · <span style="color:#f0c674">恢复中 还要 ' + (state.hud.readyAt - state.tick) + ' 回合</span>'
      : ' · <span style="color:#98c379">可以行动</span>');

  document.getElementById('meta').textContent = state.packs.join(' + ');
  document.getElementById('message').textContent = state.message;
  document.getElementById('devlog').textContent = (state.devlog || []).join('\\n');
  document.getElementById('debug').textContent = formatDebug(state.debug);

  const skills = document.getElementById('skills');
  skills.textContent = '';
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

async function act(dir) {
  render(await api('/api/act', { dir }));
}
async function useSkill(tag, x, y) {
  const body = x === undefined ? { tag } : { tag, x, y };
  render(await api('/api/skill', body));
}

function cellAt(event) {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor(((event.clientX - rect.left) / rect.width) * (canvas.width / lastTile)),
    y: Math.floor(((event.clientY - rect.top) / rect.height) * (canvas.height / lastTile)),
  };
}

document.getElementById('map').addEventListener('mousemove', (event) => {
  if (renderer === null) return;
  const now = Date.now();
  if (now - aimTimer < 40) return;
  aimTimer = now;

  const cell = cellAt(event);
  api('/api/aim', { tag: 'core.attack', x: cell.x, y: cell.y }).then((result) => {
    renderer.setAim(result.ok ? result.cells : []);
    document.getElementById('message').textContent =
      result.ok ? '可以劈砍 (' + cell.x + ',' + cell.y + ')' : (result.reason || '');
  });
});

document.getElementById('map').addEventListener('click', (event) => {
  if (renderer === null) return;
  const cell = cellAt(event);
  useSkill('core.attack', cell.x, cell.y);
});

document.querySelectorAll('button[data-dir]').forEach((button) => {
  button.addEventListener('click', () => act(button.dataset.dir));
});

window.addEventListener('keydown', (event) => {
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
})();
</script>
</html>`;

/** 结构面板用的元素在启动器页里，这里只导出页面本身。 */
export const PAGES = { LAUNCHER_PAGE, GAME_PAGE };
