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
/** 启动器：主菜单 → 开始 / 读档 / 设置 / 世界包 / 退出。 */
export const LAUNCHER_PAGE = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>{{app.title}}</title>
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
  .menu { display: flex; flex-direction: column; gap: 10px; width: min(320px, 100%); margin-top: 20px; }
  .menu button { padding: 12px 16px; text-align: left; font-size: 15px; }
  .panel { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center;
           background: rgba(0,0,0,0.55); }
  .panel[hidden] { display: none; }
  .panel.plain { background: none; }
  .card { background: #10131a; border: 1px solid #2a303c; border-radius: 10px;
          padding: 20px; min-width: min(380px, 90vw); max-width: min(560px, 92vw);
          max-height: 80vh; overflow: auto; }
  .panel h2 { font-size: 15px; color: #8ab4f8; margin: 0 0 10px; }
  .world.picked { border-color: #4a6da8; background: #1d2432; }
</style>
<main>
  <div id="errbar" hidden></div>
  <h1>{{app.title}}</h1>
  <div class="meta" id="meta">{{launcher.pick}}</div>

  <div class="menu" id="menu">
    <button id="m-start">{{menu.start}}</button>
    <button id="m-load">{{menu.load}}</button>
    <button id="m-settings">{{menu.settings}}</button>
    <button id="m-packs">{{menu.packs}}</button>
    <button id="m-quit">{{menu.quit}}</button>
  </div>

  <div class="panel" id="packs" hidden><div class="card">
    <h2>{{menu.packs}}</h2>
    <div id="worlds"></div>
    <div id="errors"></div>
    <div style="margin-top:10px"><button id="packs-back">{{menu.back}}</button></div>
  </div></div>

  <div class="panel plain" id="settings" hidden></div>
  <div class="panel plain" id="load" hidden></div>

  <div class="panel" id="quit" hidden><div class="card">
    <h2>{{menu.quit}}</h2>
    <div style="color:#9aa3b2">{{menu.quit_note}}</div>
    <div style="margin-top:10px"><button id="quit-back">{{menu.back}}</button></div>
  </div></div>
</main>

<div id="graphpanel" hidden>
  <div class="graphbar">
    <span id="graphtitle">{{launcher.structure_title}}</span>
    <button id="graphclose">{{launcher.close}}</button>
  </div>
  <div class="tree" id="tree"></div>
  <div style="margin-top:10px; display:flex; gap:10px; align-items:center">
    <span class="meta" id="offcount" style="margin:0"></span>
  </div>
</div>

<script type="module">
import { modal, col, row, text, button, input, field } from '/web/game/systems/ui/spec.js';
import { mount } from '/web/game/systems/ui/dom.js';

${ERRORS}

const KIND_ORDER = [
  ['rule', '规则'], ['component', '组件'], ['template', '模板'],
  ['terrain', '地形'], ['space', '空间'], ['entity', '实体'], ['world', '世界'],
];

let worlds = [];
let activeWorld = localStorage.getItem('nw.world') || null;
let inspecting = null;

function show(id) {
  for (const panel of ['packs', 'settings', 'load', 'quit']) {
    document.getElementById(panel).hidden = panel !== id;
  }
  // 菜单保持可见：面板是浮层，不是换页
  document.getElementById('menu').style.opacity = id === null ? '1' : '0.35';
}

function renderWorlds() {
  const list = document.getElementById('worlds');
  list.textContent = '';

  for (const world of worlds) {
    const row = document.createElement('div');
    row.className = 'world' + (world.id === activeWorld ? ' picked' : '') + (world.ok ? '' : ' bad');

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
    const pick = document.createElement('button');
    pick.textContent = world.id === activeWorld ? '已选' : '选择';
    pick.disabled = !world.ok;
    pick.addEventListener('click', () => {
      activeWorld = world.id;
      localStorage.setItem('nw.world', world.id);
      renderWorlds();
    });
    actions.appendChild(pick);

    const graph = document.createElement('button');
    graph.textContent = '{{launcher.structure}}';
    graph.style.marginLeft = '8px';
    graph.addEventListener('click', () => showGraph(world.id));
    actions.appendChild(graph);

    row.appendChild(actions);
    list.appendChild(row);
  }

  const errors = document.getElementById('errors');
  errors.textContent = '';
  for (const bad of [] ) { void bad; }
}

function openSeedDialog(worldId) {
  const existing = document.getElementById('seedbox');
  if (existing) existing.remove();

  let seed = localStorage.getItem('nw.seed') || String(Math.floor(Math.random() * 1000000000));

  const box = document.createElement('div');
  box.id = 'seedbox';
  box.style.position = 'fixed';
  box.style.inset = '0';
  box.style.zIndex = '50';

  const body = col({ gap: 12 },
    field('种子', input(seed, (next) => { seed = next; }, { type: 'number' })),
    row({ gap: 8, justify: 'end' },
      button('取消', () => box.remove()),
      button('开始', () => {
        const value = String(Number(seed) || 0);
        localStorage.setItem('nw.seed', value);
        location.href = '/game?world=' + encodeURIComponent(worldId) + '&seed=' + encodeURIComponent(value);
      }),
    ),
  );

  mount(box, modal(body, { title: worldId + ' · 输入种子' }));
  document.body.appendChild(box);
}

async function showGraph(id) {
  inspecting = id;
  const panel = document.getElementById('graphpanel');
  const tree = document.getElementById('tree');
  document.getElementById('graphtitle').textContent = '{{launcher.structure_title}} · ' + id;
  panel.hidden = false;
  tree.textContent = '{{launcher.reading}}';

  let result;
  try { result = await api('/api/graph', { id }); }
  catch (error) { tree.textContent = '请求失败：' + error; return; }
  if (!result || result.ok !== true) { tree.textContent = '读不出来：' + (result && result.error ? result.error : '未知'); return; }

  tree.textContent = '';
  buildTree(tree, result.nodes);
  updateOffCount();
}

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
    const label = document.createElement('label');
    label.className = 'group';
    const group = document.createElement('input');
    group.type = 'checkbox';
    group.checked = true;
    group.addEventListener('click', (event) => event.stopPropagation());
    group.addEventListener('change', () => {
      for (const input of box.querySelectorAll('input[data-rule]')) input.checked = group.checked;
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
      input.type = 'checkbox'; input.checked = true; input.dataset.rule = node.label;
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
  localStorage.setItem('nw.off', JSON.stringify(off));
  document.getElementById('offcount').textContent = off.length === 0 ? '' : '关掉 ' + off.length + ' 条规则';
}

function loadRules() {
  try { return JSON.parse(localStorage.getItem('nw.off') || '[]'); } catch { return []; }
}

document.getElementById('m-start').addEventListener('click', () => {
  if (!activeWorld) {
    document.getElementById('meta').textContent = '{{menu.no_world}}';
    show('packs');
    return;
  }
  openSeedDialog(activeWorld);
});

document.getElementById('m-load').addEventListener('click', async () => {
  show('load');
  await renderLoad();
});



document.getElementById('m-settings').addEventListener('click', () => { show('settings'); renderSettings(); });

document.getElementById('m-packs').addEventListener('click', () => { show('packs'); renderWorlds(); });
document.getElementById('packs-back').addEventListener('click', () => show(null));
document.getElementById('m-quit').addEventListener('click', () => show('quit'));
document.getElementById('quit-back').addEventListener('click', () => show(null));
document.getElementById('graphclose').addEventListener('click', () => { document.getElementById('graphpanel').hidden = true; });

function renderSettings() {
  const speeds = [5, 10, 20];
  const current = Number(localStorage.getItem('nw.speed') || '10');
  const bindings = JSON.parse(localStorage.getItem('nw.bindings') || '{}');
  const lines = Object.entries(bindings).map(([code, command]) => code + ' → ' + command);

  const speedButtons = speeds.map((speed) =>
    button((speed === current ? '● ' : '') + speed + ' 格/秒', () => {
      localStorage.setItem('nw.speed', String(speed));
      renderSettings();
    }),
  );

  const body = col({ gap: 12 },
    text('动画速度', { policy: 'fixed' }),
    row({ gap: 6 }, ...speedButtons),
    text(lines.length > 0 ? '按键：' + lines.join('   ') : '按键：默认', { policy: 'fixed' }),
    row({ gap: 8, justify: 'end' }, button('← 返回', () => show(null))),
  );

  mount(document.getElementById('settings'), modal(body, { title: '设置' }));
}

async function renderLoad() {
  const box = document.getElementById('load');

  const draw = (saves, message) => {
    const rows = saves.map((save) => {
      const label = save.broken
        ? save.slot + '（损坏）'
        : save.slot + ' · ' + (save.world || '?') + ' · 种子 ' + save.seed + ' · tick ' + save.tick +
          (save.savedAt ? ' · ' + save.savedAt.slice(0, 16).replace('T', ' ') : '');
      return row({ gap: 8, align: 'center' },
        text(label, { policy: 'fill' }),
        save.broken ? text('—', { policy: 'fixed' }) : button('读取', () => tryLoad(save.slot)),
      );
    });

    mount(box, modal(col({ gap: 10 },
      text(message, { policy: 'fixed' }),
      ...rows,
      row({ gap: 8, justify: 'end' }, button('← 返回', () => show(null))),
    ), { title: '读档' }));
  };

  const tryLoad = async (slot) => {
    draw([], '正在读取…');
    const result = await api('/api/load', { slot });
    if (result && result.ok === false) {
      const missing = result.missing && result.missing.length ? '缺：' + result.missing.join(', ') : '';
      const extra = result.extra && result.extra.length ? '多：' + result.extra.join(', ') : '';
      const saves = await api('/api/saves');
      draw(saves.saves || [], result.error + '   ' + [missing, extra].filter(Boolean).join('   '));
      return;
    }
    location.href = '/game?world=' + encodeURIComponent(result.world || activeWorld || '') + '&loaded=1';
  };

  draw([], '正在读取存档列表…');
  const result = await api('/api/saves');
  if (!result || result.ok !== true) {
    draw([], '读不出存档列表：' + (result && result.error ? result.error : '未知'));
    return;
  }
  draw(result.saves || [], (result.saves || []).length === 0 ? '还没有存档。游戏里点「存档」会写一份。' : '选择一个存档读取：');
}

document.getElementById('quit-back').textContent = '{{menu.back}}';

api('/api/worlds').then((state) => {
  worlds = state.worlds || [];
  if (!activeWorld && worlds.length > 0) {
    const usable = worlds.find((world) => world.ok);
    if (usable) activeWorld = usable.id;
  }
  renderWorlds();
  document.getElementById('meta').textContent = '{{launcher.pick}}';
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
  /* 左侧立绘：现在只有占位，以后换成图 */
  #portrait { position: absolute; left: 10px; top: 54px; width: 168px;
              background: rgba(16,19,26,0.8); border: 1px solid #2a303c; border-radius: 10px;
              padding: 8px; text-align: center; }
  #portrait-toggle { position: absolute; right: -12px; top: 50%; transform: translateY(-50%);
                      width: 22px; height: 44px; padding: 0; border-radius: 6px;
                      background: #1b1f27; border: 1px solid #333a4a; color: #9aa3b2;
                      cursor: pointer; z-index: 2; }
  #portrait.collapsed { width: 0; padding: 0; border-color: transparent; background: transparent; }
  #portrait.collapsed #portrait-art,
  #portrait.collapsed #nameplate { display: none; }
  #portrait.collapsed #portrait-toggle { right: -22px; }
  #portrait { transition: width 120ms ease; }
  #portrait-art { height: 190px; display: flex; align-items: center; justify-content: center;
                  background: #0f1116; border-radius: 6px; color: #8ab4f8; font-size: 48px; }
  #nameplate { margin-top: 6px; color: #d7dae0; font-weight: 600; }

  #status { position: absolute; left: 10px; top: 320px; width: 168px; padding: 8px 10px;
            background: rgba(16,19,26,0.8); border: 1px solid #2a303c; border-radius: 8px;
            font-size: 13px; line-height: 1.6; }
  #skills { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
            display: flex; gap: 6px; margin: 0; }
  #skills button { min-width: 64px; height: 52px; }
  #skills .hint { display: none; }
  #message { position: absolute; bottom: 78px; left: 50%; transform: translateX(-50%);
             margin: 0; padding: 4px 10px; background: rgba(16,19,26,0.7); border-radius: 6px;
             white-space: nowrap; }
  #logbox { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: min(560px, 60vw);
            max-height: 92px; overflow: hidden; padding: 6px 12px; background: rgba(16,19,26,0.72);
            border-radius: 8px; color: #9aa3b2; font-size: 12px; white-space: pre; }
  #tooltip { position: fixed; z-index: 30; pointer-events: none; max-width: 320px;
             padding: 6px 10px; background: rgba(10,12,16,0.92); border: 1px solid #2a303c;
             border-radius: 6px; color: #c7cdd6; font-size: 12px; white-space: pre-wrap; }
  #devpanel { position: absolute; top: 10px; right: 10px; max-width: min(460px, 92vw); }

  /* 窄屏：HUD 收起来，别互相压 */
  @media (max-width: 900px) {
    #logbox { display: none; }
    #portrait { width: 120px; }
    #portrait-art { height: 130px; font-size: 34px; }
    #status { width: 120px; top: 250px; font-size: 12px; }
    #message { bottom: 74px; max-width: 92vw; overflow: hidden; text-overflow: ellipsis; }
  }
  @media (max-width: 640px) {
    #status { font-size: 12px; padding: 4px 6px; }
    #topbar .meta { display: none; }
    #skills { gap: 4px; bottom: 8px; }
    #skills button { min-width: 52px; height: 46px; font-size: 12px; padding: 0 6px; }
    #devpanel:not([open]) { display: none; }
  }
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

  <div id="portrait">
    <button id="portrait-toggle" title="收起/展开">‹</button>
    <div id="portrait-art"><span id="portrait-glyph">@</span></div>
    <div id="nameplate">你</div>
  </div>

  <div id="status"></div>

  <div id="skills"></div>
  <div id="message"></div>
  <div id="logbox"></div>

  <div id="settings" hidden></div>
  <div id="tooltip" hidden></div>
  <div id="death" hidden></div>
  <div id="inventory" hidden></div>

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
import { attach } from '/web/game/systems/render/browser.js';
import { row, col, text, button, toggle, modal } from '/web/game/systems/ui/spec.js';
import { resolveBindings, commandFor, parseCommand } from '/web/game/systems/input/bindings.js';
import { mount, render as renderNode } from '/web/game/systems/ui/dom.js';

${ERRORS}

const params = new URLSearchParams(location.search);
const worldId = params.get('world');
const offFromUrl = (params.get('off') || '').split(',').filter(Boolean);
const off = offFromUrl.length > 0
  ? offFromUrl
  : (JSON.parse(localStorage.getItem('nw.off') || '[]'));
const seed = Number(params.get('seed') || '0') || 0;

let renderer = null;
let aimTimer = 0;
let tile = 32;

// 按键：物理键 → 命令。用户设置覆盖默认。
const bindings = resolveBindings(JSON.parse(localStorage.getItem('nw.bindings') || '{}'));

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

  const portrait = document.getElementById('portrait-glyph');
  if (portrait) portrait.textContent = state.playerGlyph || '@';
  const plate = document.getElementById('nameplate');
  if (plate) plate.textContent = state.playerName || '你';

  document.getElementById('status').innerHTML =
    'HP <b>' + state.hud.hp + '/' + state.hud.hpMax + '</b>' +
    ' · 背包 <b>' + state.hud.inventory.length + '</b>' +
    ' · tick <b>' + state.tick + '</b><br>' +
    (state.hud.readyAt > state.tick
      ? '<span style="color:#f0c674">恢复中 还要 ' + (state.hud.readyAt - state.tick) + ' 回合</span>'
      : '<span style="color:#98c379">可以行动</span>');

  document.getElementById('meta').textContent = state.packs.join(' + ');
  if (state.dead) showDeath();
  document.getElementById('message').textContent = state.message;
  document.getElementById('logbox').textContent = (state.events || []).slice(-5).join('\\n');
  document.getElementById('devlog').textContent = (state.devlog || []).join('\\n');
  document.getElementById('debug').textContent = formatDebug(state.debug);

  renderHotbar(state);
}

let inventoryItems = [];
let stateSkills = [];
let selectedItem = null;

async function openInventory() {
  const box = document.getElementById('inventory');
  box.hidden = false;

  const data = await api('/api/inventory');
  inventoryItems = (data && data.items) || [];
  selectedItem = inventoryItems[0] ?? null;
  drawInventory();
}

/** 左详情 + 右 6 列格子；点格子只选中，不放动作。 */
function drawInventory() {
  const box = document.getElementById('inventory');

  const detail = selectedItem === null
    ? col({ gap: 6 }, text('没有选中物品', { policy: 'fixed' }))
    : col({ gap: 6 },
        text(selectedItem.name, { policy: 'fixed' }),
        text(selectedItem.description, { policy: 'fixed' }),
        row({ gap: 6 },
          button('放下', () => dropSelected()),
        ),
      );

  const cells = inventoryItems.map((item) => {
    const picked = selectedItem !== null && item.handle === selectedItem.handle;
    const node = button(item.name, () => { selectedItem = item; drawInventory(); });
    node.style.width = '72px';
    node.style.height = '72px';
    node.style.flex = '0 0 auto';
    node.style.background = picked ? '#2d3a52' : '#161a22';
    node.style.border = picked ? '1px solid #4a6da8' : '1px solid #2a303c';
    node.draggable = true;
    node.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'item', ref: item.handle }));
    });
    return node;
  });

  const grid = row({ gap: 6 },
    ...cells,
    ...(cells.length === 0 ? [text('空', { policy: 'fixed' })] : []),
  );
  grid.style['flex-wrap'] = 'wrap';
  grid.style.width = '6px';

  const skillChips = (stateSkills || []).map((skill) => {
    const node = button(skill.name, () => {});
    node.style['font-size'] = '11px';
    node.draggable = true;
    node.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'skill', ref: skill.tag }));
    });
    return node;
  });

  const body = row({ gap: 16, align: 'flex-start' },
    col({ gap: 8, width: 220 }, detail),
    col({ gap: 8, width: 470 },
      text('技能（拖到快捷栏）', { policy: 'fixed' }),
      row({ gap: 6 }, ...skillChips),
      text('道具（拖到快捷栏）', { policy: 'fixed' }),
      grid,
    ),
  );

  box.textContent = '';
  box.appendChild(renderNode(modal(col({ gap: 12 },
    body,
    row({ gap: 8, justify: 'end' },
      button('关闭 I', () => closeInventory()),
    ),
  ), { title: '背包' })));
}

async function dropSelected() {
  if (selectedItem === null) return;
  await api('/api/skill', { tag: 'core.drop' });
  await openInventory();
}

function closeInventory() {
  const box = document.getElementById('inventory');
  box.hidden = true;
  box.textContent = '';
}

function toggleInventory() {
  const box = document.getElementById('inventory');
  if (box.hidden) openInventory(); else closeInventory();
}

function applyPortraitCollapsed() {
  const box = document.getElementById('portrait');
  const collapsed = localStorage.getItem('nw.portrait') === '0';
  box.classList.toggle('collapsed', collapsed);
  document.getElementById('portrait-toggle').textContent = collapsed ? '›' : '‹';
}

document.getElementById('portrait-toggle').addEventListener('click', () => {
  const collapsed = localStorage.getItem('nw.portrait') === '0';
  localStorage.setItem('nw.portrait', collapsed ? '1' : '0');
  applyPortraitCollapsed();
});

const HOTBAR_SLOTS = 9;

/** 槽位内容：[{ kind: "skill" | "item", ref }] 或 null。 */
function loadHotbar() {
  try {
    const raw = JSON.parse(localStorage.getItem('nw.hotbar') || '[]');
    const slots = new Array(HOTBAR_SLOTS).fill(null);
    for (let i = 0; i < HOTBAR_SLOTS; i += 1) slots[i] = raw[i] ?? null;
    return slots;
  } catch {
    return new Array(HOTBAR_SLOTS).fill(null);
  }
}

function saveHotbar(slots) {
  localStorage.setItem('nw.hotbar', JSON.stringify(slots));
}

let hotbarSlots = loadHotbar();
let hotbarSkills = [];
let hotbarItems = [];

function hotbarLabel(entry) {
  if (entry === null) return '';
  if (entry.kind === 'skill') {
    const skill = hotbarSkills.find((item) => item.tag === entry.ref);
    return skill ? skill.name : entry.ref;
  }
  const item = hotbarItems.find((row) => row.handle === entry.ref);
  return item ? item.name : '道具 ' + entry.ref;
}

function renderHotbar(state) {
  hotbarSkills = state.skills.filter((skill) => skill.tag !== 'core.move');
  hotbarItems = state.hud && state.hud.items ? state.hud.items : hotbarItems;

  const cells = hotbarSlots.map((entry, index) => {
    const label = hotbarLabel(entry);
    const node = button(String(index + 1) + (label ? ' ' + label : ''), () => activateSlot(index));
    node.style.width = '72px';
    node.style.height = '72px';
    node.style.flex = '0 0 auto';
    node.style['font-size'] = '11px';
    node.style.padding = '2px';
    node.style.background = entry ? '#1d2432' : '#141821';

    // 拖入绑定
    node.addEventListener('dragover', (event) => event.preventDefault());
    node.addEventListener('drop', (event) => {
      event.preventDefault();
      try {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        hotbarSlots[index] = { kind: data.kind, ref: data.ref };
        saveHotbar(hotbarSlots);
        renderHotbar(state);
      } catch {
        // 拖进来不是 JSON，忽略
      }
    });
    // 右键清空
    node.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      hotbarSlots[index] = null;
      saveHotbar(hotbarSlots);
      renderHotbar(state);
    });
    return node;
  });

  const extras = [
    button('等待', () => useSkill('core.wait')),
    button('背包', () => toggleInventory()),
    button('设置', () => openSettings()),
  ];
  for (const node of extras) {
    node.style.width = '56px';
    node.style.height = '72px';
    node.style.flex = '0 0 auto';
    node.style['font-size'] = '12px';
  }

  mount(document.getElementById('skills'), row({ gap: 6, align: 'center' }, ...cells, ...extras));
}

function activateSlot(index) {
  const entry = hotbarSlots[index];
  if (entry === null) {
    document.getElementById('message').textContent = '这个槽是空的：从背包拖一个技能或道具上来。';
    return;
  }
  if (entry.kind === 'skill') useSkill(entry.ref);
  else document.getElementById('message').textContent = '物品还不能直接用（等 core.use）。';
}

function showDeath() {
  const box = document.getElementById('death');
  if (!box.hidden) return;

  const body = col({ gap: 12 },
    text('你倒下了。', { policy: 'fixed' }),
    row({ gap: 8, justify: 'end' },
      button('读档', async () => { await api('/api/load', {}); location.reload(); }),
      button('重开', () => { location.href = '/game?world=' + encodeURIComponent(worldId) + '&seed=' + seed; }),
    ),
  );

  mount(box, modal(body, { title: '结束' }));
  box.hidden = false;
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
  renderer.setCursor(cell);
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
  if (renderer !== null) {
    renderer.setAim([]);
    renderer.setCursor(null);
  }
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
  const command = commandFor(bindings, event.code);
  if (command === undefined) return;

  const parsed = parseCommand(command);

  if (parsed.kind === 'ui') {
    if (parsed.value === 'inventory') {
      toggleInventory();
      return;
    }
    if (parsed.value === 'settings') {
      const box = document.getElementById('settings');
      if (box.hidden) openSettings(); else closeSettings();
    }
    return;
  }

  const digit = event.code.match(/^Digit([1-9])$/);
  if (digit !== null) {
    activateSlot(Number(digit[1]) - 1);
    return;
  }

  if (!document.getElementById('settings').hidden) return;
  if (parsed.kind === 'move') act(parsed.value);
  else if (parsed.kind === 'skill') useSkill(parsed.value);
});

(async () => {
  if (!worldId) {
    document.getElementById('errbar').hidden = false;
    document.getElementById('errbar').textContent = '没有指定世界：请从启动器进入。';
    return;
  }
  // 读档流程已经建好会话，直接用；否则按选择开局。
  let state = await api('/api/state');
  if (!state || state.launcher) {
    state = await api('/api/start', { id: worldId, off, seed });
  }
  if (!state || state.launcher) {
    document.getElementById('errbar').hidden = false;
    document.getElementById('errbar').textContent = '世界载入失败：' + (state && state.errors && state.errors[0] ? state.errors[0].error : '未知');
    return;
  }
  stateSkills = state.skills;
  hotbarItems = (await api('/api/inventory')).items || [];
  render(state);
  applySettings();
  applyPortraitCollapsed();
})();
</script>
</html>`;

/** 结构面板用的元素在启动器页里，这里只导出页面本身。 */
export const PAGES = { LAUNCHER_PAGE, GAME_PAGE };
