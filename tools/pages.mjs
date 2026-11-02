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
  #graphpanel { position: fixed; inset: 40px 60px; z-index: 100; display: flex; flex-direction: column;
                pointer-events: auto;
                background: #10131a; border: 1px solid #2a303c; border-radius: 10px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6); padding: 12px 16px; }
  .graphbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .graphbar span { color: #8ab4f8; font-weight: 600; }
  #tree { margin: 0; flex: 1 1 auto; min-height: 0; overflow: auto; color: #9aa3b2; font-size: 12px;
          overflow-x: auto;
          padding-right: 6px; }
  #tree::-webkit-scrollbar { width: 10px; }
  #tree::-webkit-scrollbar-thumb { background: #2a303c; border-radius: 5px; }
  #tree::-webkit-scrollbar-track { background: #0f1116; }
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
  .tree .leaf { margin-left: 22px; padding: 2px 0; color: #8b929e; display: flex; gap: 6px;
                align-items: baseline; white-space: nowrap; }
  .tree .leaf .id { color: #5f6b7a; font-size: 11px; }
  .tree .leaf .desc { color: #6f7a89; font-size: 11px; }
  .tree label.group { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
  /* 自绘勾选框：不依赖系统主题，暗色背景下一定看得见 */
  .tree input[type=checkbox] { appearance: none; -webkit-appearance: none; position: relative;
                               width: 14px; height: 14px; border: 1px solid #4a6da8; border-radius: 3px;
                               background: #0f1116; cursor: pointer; flex: 0 0 auto; margin: 0; }
  .tree input[type=checkbox]:checked { background: #4a6da8; }
  .tree input[type=checkbox]:checked::after { content: ""; position: absolute; left: 4px; top: 1px;
                                              width: 4px; height: 8px; border: solid #fff;
                                              border-width: 0 2px 2px 0; transform: rotate(45deg); }
  .tree input[type=checkbox]:indeterminate { background: #4a6da8; }
  .tree input[type=checkbox]:indeterminate::after { content: ""; position: absolute; left: 3px; top: 6px;
                                                    width: 8px; height: 2px; background: #fff; }
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

  // 这个世界的选择存在 saves/selection.json（AI 也能读写）
  const saved = await api('/api/selection?world=' + encodeURIComponent(id));
  const off = new Set((saved && saved.off) || []);
  const offTemplates = new Set((saved && saved.offTemplates) || []);
  for (const input of tree.querySelectorAll('input[data-rule]')) {
    const id = input.dataset.rule;
    input.checked = input.dataset.kind === 'template' ? !offTemplates.has(id) : !off.has(id);
  }
  syncGroupStates();
  updateOffCount();
}

function buildTree(root, nodes) {
  const packs = new Map();
  for (const node of nodes) {
    if (!packs.has(node.origin)) packs.set(node.origin, []);
    packs.get(node.origin).push(node);
  }

  // 有规则的包排前面：选择块第一眼就能看到
  const ordered = [...packs.entries()].sort((a, b) => {
    const aRules = a[1].some((node) => node.kind === "rule") ? 0 : 1;
    const bRules = b[1].some((node) => node.kind === "rule") ? 0 : 1;
    return aRules - bRules;
  });

  for (const [origin, list] of ordered) {
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
      syncGroupStates();
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
    // 每一类都能勾：规则真正生效，其余先记录（模板会影响生成）
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    input.dataset.rule = node.label;
    input.dataset.kind = node.kind;
    input.addEventListener('change', () => { syncGroupStates(); updateOffCount(); });
    leaf.appendChild(input);
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

    // 被谁用：0 引用就是死模块，值得一眼看出来
    if (Array.isArray(node.usedBy)) {
      const refs = document.createElement('span');
      refs.className = 'desc';
      refs.style.marginLeft = 'auto';
      refs.style.color = node.usedBy.length === 0 ? '#c96a5a' : '#5f6b7a';
      refs.textContent = node.usedBy.length === 0 ? '未被引用' : '被 ' + node.usedBy.length + ' 处引用';
      leaf.appendChild(refs);
    }
    box.appendChild(leaf);
  }
  return box;
}

/** 让分组勾选框显示「全选 / 半选 / 未选」。 */
function syncGroupStates() {
  for (const box of document.querySelectorAll('.tree details')) {
    const group = box.querySelector('summary input');
    if (group === null) continue;
    const inputs = Array.from(box.querySelectorAll('input[data-rule]'));
    if (inputs.length === 0) continue;
    const on = inputs.filter((input) => input.checked).length;
    group.checked = on === inputs.length;
    group.indeterminate = on > 0 && on < inputs.length;
  }
}

function disabledRules() {
  return Array.from(document.querySelectorAll('input[data-rule]'))
    .filter((input) => !input.checked && (input.dataset.kind === 'rule' || input.dataset.kind === undefined))
    .map((input) => input.dataset.rule);
}

function disabledTemplates() {
  return Array.from(document.querySelectorAll('input[data-rule]'))
    .filter((input) => !input.checked && input.dataset.kind === 'template')
    .map((input) => input.dataset.rule);
}

function updateOffCount() {
  const off = disabledRules();
  localStorage.setItem('nw.off', JSON.stringify(off));
  if (inspecting !== null) {
    api('/api/selection', { world: inspecting, off, offTemplates: disabledTemplates() });
  }
  document.getElementById('offcount').textContent = off.length === 0 ? '' : '关掉 ' + off.length + ' 条规则';
}

function loadRules() {
  try { return JSON.parse(localStorage.getItem('nw.off') || '[]'); } catch { return []; }
}

document.getElementById('m-start').addEventListener('click', async () => {
  if (activeWorld !== null) {
    const saved = await api('/api/selection?world=' + encodeURIComponent(activeWorld));
    if (saved && Array.isArray(saved.off)) {
      localStorage.setItem('nw.off', JSON.stringify(saved.off));
    }
  }
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
  #stage { display: flex; width: 100vw; height: 100vh; }
  #leftrail { width: 200px; flex: 0 0 auto; padding: 8px; box-sizing: border-box;
              background: #0d1015; border-right: 1px solid #1d222b;
              overflow-y: auto; transition: width 120ms ease; }
  #leftrail.collapsed { width: 32px; padding: 6px 2px; }
  #stage-map { position: relative; flex: 1 1 auto; min-width: 0; }
  #map { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 0; }
  #hud { position: absolute; inset: 0; pointer-events: none; }
  #hud > * { pointer-events: auto; }
  #topbar { position: absolute; top: 10px; left: 10px; right: 10px; display: flex; gap: 8px;
           align-items: center; pointer-events: none; }
  #topbar > * { pointer-events: auto; }
  #topbar a { margin-right: auto; }
            padding: 4px 8px; background: rgba(16,19,26,0.75); border-radius: 8px; }
  /* 左侧立绘：现在只有占位，以后换成图 */
  #portrait { position: relative; width: 100%; box-sizing: border-box;
              background: rgba(16,19,26,0.8); border: 1px solid #2a303c; border-radius: 10px;
              padding: 8px; text-align: center; }
  #portrait-toggle { position: absolute; right: -12px; top: 50%; transform: translateY(-50%);
                      width: 22px; height: 44px; padding: 0; border-radius: 6px;
                      background: #1b1f27; border: 1px solid #333a4a; color: #9aa3b2;
                      cursor: pointer; z-index: 2; }
  #portrait.collapsed { width: 20px; padding: 0; }
  #portrait.collapsed #portrait-toggle { right: auto; left: 0; width: 20px; height: 56px; border-radius: 4px; }
  #portrait.collapsed #portrait-art,
  #portrait.collapsed #nameplate { display: none; }
  #portrait { transition: width 120ms ease; }
  #portrait-art { height: 190px; max-height: 30vh; display: flex; align-items: center; justify-content: center;
                  background: #0f1116; border-radius: 6px; color: #8ab4f8; font-size: 48px; }
  #nameplate { margin-top: 6px; color: #d7dae0; font-weight: 600; }

  #status { position: relative; margin-top: 8px; width: 100%; box-sizing: border-box;
            padding: 8px 10px; background: rgba(16,19,26,0.8); border: 1px solid #2a303c;
            border-radius: 8px; font-size: 13px; line-height: 1.6; }
  #equip { margin-top: 8px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
  #equip .slot { height: 44px; border: 1px solid #2a303c; background: #12151c; }
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
  #quick { position: absolute; right: 10px; bottom: 10px; z-index: 3; }
  #minimap { position: absolute; right: 10px; top: 54px; padding: 4px; z-index: 2;
             background: rgba(16,19,26,0.8); border: 1px solid #2a303c; border-radius: 6px; }
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

<div id="stage">
  <aside id="leftrail">
    <div id="portrait">
      <button id="portrait-toggle" title="收起/展开">‹</button>
      <div id="portrait-art"><span id="portrait-glyph">@</span></div>
      <div id="nameplate">你</div>
    </div>
    <div id="status"></div>
    <div id="equip" title="装备（以后接数据）"></div>
  </aside>

  <div id="stage-map">
<canvas id="map"></canvas>

<div id="hud">
  <div id="errbar" hidden></div>

  <div id="topbar">
    <a href="/">{{game.back}}</a>
    <button id="settingsbtn">{{menu.settings}}</button>
  </div>

  <div id="minimap"></div>
  <div id="skills"></div>
  <div id="quick"></div>
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
  </div>
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
import { row, col, text, button, toggle, modal, grid, bar, canvasNode, withEvents } from '/web/game/systems/ui/spec.js';
import { drawMinimap, minimapSize } from '/web/game/systems/ui/minimap.js';
import { clampCell, loadConfig, saveConfig, withBinding, withConfig } from '/web/game/systems/config/config.js';
import { commandFor, parseCommand } from '/web/game/systems/input/bindings.js';
import { mount, render as renderNode } from '/web/game/systems/ui/dom.js';

${ERRORS}

// 游戏页面不该有浏览器的默认权力：拖拽不要导航、右键不要菜单、文字不要选中
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('selectstart', (event) => {
  if (event.target instanceof HTMLElement && event.target.tagName !== 'INPUT') event.preventDefault();
});

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
let config = loadConfig();
const bindings = () => config.bindings;

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
  lastState = state;
  if (renderer === null) {
    renderer = attach(document.getElementById('map'), { tile: state.tile });
  }
  tile = state.tile;
  renderer.setState(state);

  const portrait = document.getElementById('portrait-glyph');
  if (portrait) portrait.textContent = state.playerGlyph || '@';
  const plate = document.getElementById('nameplate');
  if (plate) plate.textContent = state.playerName || '你';

  renderMinimap(state);

  const ready = state.hud.readyAt > state.tick
    ? '恢复中 还要 ' + (state.hud.readyAt - state.tick) + ' 回合'
    : '可以行动';

  mount(document.getElementById('status'), col({ gap: 6 },
    bar(state.hud.hp, state.hud.hpMax, { label: 'HP', showValue: true, height: 16, color: state.hud.hp * 3 < state.hud.hpMax ? '#c96a5a' : '#4fd658' }),
    text('背包 ' + state.hud.inventory.length + ' · tick ' + state.tick, { policy: 'fixed' }),
    text(ready, { policy: 'fixed' }),
  ));

  if (state.dead) showDeath();
  document.getElementById('message').textContent = state.message;
  document.getElementById('logbox').textContent = (state.events || []).slice(-5).join('\\n');
  document.getElementById('devlog').textContent = (state.devlog || []).join('\\n');
  document.getElementById('debug').textContent = formatDebug(state.debug);

  renderHotbar(state);
}

let inventoryItems = [];
let stateSkills = [];
let selectedCell = null;
let inventoryPage = 0;
let lastState = null;
let INVENTORY_COLUMNS = config.inventoryColumns;
const INVENTORY_ROWS = config.inventoryRows;
const INVENTORY_PER_PAGE = 40;
let INVENTORY_CELL = config.inventoryCell;
let HOTBAR_CELL = config.hotbarCell;

/** 技能也当成「物品」：统一成 {kind, ref, name, desc}。 */
function allEntries() {
  const skills = stateSkills
    .filter((skill) => skill.tag !== 'core.move')
    .map((skill) => ({ kind: 'skill', ref: skill.tag, name: skill.name, desc: '技能' }));
  const items = inventoryItems.map((item) => ({
    kind: 'item', ref: item.handle, name: item.name, desc: item.description,
  }));
  return [...skills, ...items];
}

async function openInventory() {
  const box = document.getElementById('inventory');
  box.hidden = false;
  const data = await api('/api/inventory');
  inventoryItems = (data && data.items) || [];
  selectedCell = null;
  inventoryPage = 0;
  drawInventory();
}

/** 方格纸风格：直角、细线、无间隙。 */
function cellStyle(node, size, picked) {
  node.style.width = size + 'px';
  node.style.height = size + 'px';
  node.style.flex = '0 0 auto';
  node.style['border-radius'] = '0';
  node.style.border = '1px solid #2a303c';
  node.style.background = picked ? '#26303f' : 'transparent';
  node.style['font-size'] = '10px';
  node.style.padding = '0';
  return node;
}

function entryCell(entry, index) {
  if (entry === undefined) {
    const empty = text('', { policy: 'fixed', width: INVENTORY_CELL, height: INVENTORY_CELL });
    cellStyle(empty, INVENTORY_CELL, false);
    return empty;
  }

  const picked = selectedCell !== null && selectedCell.kind === entry.kind && selectedCell.ref === entry.ref;
  const node = button(entry.name, () => { selectedCell = entry; drawInventory(); });
  cellStyle(node, INVENTORY_CELL, picked);
  return withEvents(node, {
    dragstart: (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ kind: entry.kind, ref: entry.ref }));
    },
  }, { draggable: 'true' });
}

function hotbarMiniCell(index) {
  const entry = hotbarSlots[index];
  const node = button(entry === null ? String(index + 1) : hotbarLabel(entry), () => {});
  cellStyle(node, HOTBAR_CELL, false);
  node.style['font-size'] = '8px';
  return withEvents(node, {
    dragover: (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; },
    drop: (event) => {
      event.preventDefault();
      const data = JSON.parse(event.dataTransfer.getData('text/plain'));
      hotbarSlots[index] = { kind: data.kind, ref: data.ref };
      saveHotbar(hotbarSlots);
      if (lastState !== null) renderHotbar(lastState);
      drawInventory();
    },
    contextmenu: (event) => {
      event.preventDefault();
      hotbarSlots[index] = null;
      saveHotbar(hotbarSlots);
      if (lastState !== null) renderHotbar(lastState);
      drawInventory();
    },
  });
}

function drawInventory() {
  const box = document.getElementById('inventory');
  const entries = allEntries();
  const pages = Math.max(1, Math.ceil(entries.length / INVENTORY_PER_PAGE));
  inventoryPage = Math.min(inventoryPage, pages - 1);

  const start = inventoryPage * INVENTORY_PER_PAGE;
  const cells = [];
  for (let i = 0; i < INVENTORY_PER_PAGE; i += 1) {
    cells.push(entryCell(entries[start + i], i));
  }

  const detail = selectedCell === null
    ? col({ gap: 4 }, text('没有选中格子', { policy: 'fixed' }))
    : col({ gap: 4 },
        text(selectedCell.name, { policy: 'fixed' }),
        text(selectedCell.desc, { policy: 'fixed' }),
      );

  const pager = row({ gap: 6, align: 'center' },
    button('‹', () => { inventoryPage = Math.max(0, inventoryPage - 1); drawInventory(); }),
    text('第 ' + (inventoryPage + 1) + ' / ' + pages + ' 页', { policy: 'fixed' }),
    button('›', () => { inventoryPage = Math.min(pages - 1, inventoryPage + 1); drawInventory(); }),
  );

  const miniHotbar = grid({ columns: HOTBAR_COLUMNS, cell: HOTBAR_CELL, gap: 0 },
    ...hotbarSlots.map((_, index) => hotbarMiniCell(index)),
  );

  const body = row({ gap: 12, align: 'flex-start' },
    col({ gap: 6, width: 110 }, detail),
    col({ gap: 8 },
      text('背包（拖到下面的快捷栏）', { policy: 'fixed' }),
      grid({ columns: INVENTORY_COLUMNS, cell: INVENTORY_CELL, gap: 0 }, ...cells),
      pager,
      text('快捷栏 1–9（右键清空）', { policy: 'fixed' }),
      miniHotbar,
    ),
  );

  box.textContent = '';
  box.appendChild(renderNode(modal(col({ gap: 10 },
    body,
    row({ gap: 8, justify: 'end' }, button('关闭 I', () => closeInventory())),
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
  const stored = localStorage.getItem('nw.portrait');
  const collapsed = stored === '0';
  box.classList.toggle('collapsed', collapsed);
  document.getElementById('portrait-toggle').textContent = collapsed ? '›' : '‹';
}

document.getElementById('portrait-toggle').addEventListener('click', () => {
  const collapsed = localStorage.getItem('nw.portrait') === '0';
  localStorage.setItem('nw.portrait', collapsed ? '1' : '0');
  applyPortraitCollapsed();
});

const HOTBAR_SLOTS = 24;
const HOTBAR_COLUMNS = 12;

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
    // 技能被关掉了：显示占位符，不显示内部 id
    return skill ? skill.name : '—';
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
    node.style.width = '38px';
    node.style.height = '38px';
    node.style.flex = '0 0 auto';
    node.style['font-size'] = '8px';
    node.style.padding = '0';
    node.style['border-radius'] = '0';
    node.style.border = '1px solid #2a303c';
    node.style.background = entry ? '#1d2432' : 'transparent';

    return withEvents(node, {
      dragover: (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      },
      drop: (event) => {
        event.preventDefault();
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        hotbarSlots[index] = { kind: data.kind, ref: data.ref };
        saveHotbar(hotbarSlots);
        renderHotbar(state);
      },
      contextmenu: (event) => {
        event.preventDefault();
        hotbarSlots[index] = null;
        saveHotbar(hotbarSlots);
        renderHotbar(state);
      },
    });
  });

  const extras = [
    button('等待', () => useSkill('core.wait')),
    button('背包', () => toggleInventory()),
  ];
  for (const node of extras) {
    node.style.width = '34px';
    node.style.height = '38px';
    node.style.flex = '0 0 auto';
    node.style['font-size'] = '9px';
    node.style['border-radius'] = '0';
    node.style['margin-left'] = '4px';
  }

  const bar = grid({ columns: HOTBAR_COLUMNS, cell: config.hotbarCell, gap: 0 }, ...cells);
  mount(document.getElementById('skills'), row({ gap: 8, align: 'center' }, bar, ...extras));
}

const QUICK_COLUMNS = 3;
const QUICK_SLOTS = 12;

const DEFAULT_QUICK = [
  { kind: 'skill', ref: 'core.take' },
  { kind: 'skill', ref: 'core.drop' },
  { kind: 'skill', ref: 'core.wait' },
  { kind: 'skill', ref: 'core.attack' },
  { kind: 'ui', ref: 'inventory' },
  { kind: 'ui', ref: 'settings' },
  { kind: 'ui', ref: 'save' },
  { kind: 'ui', ref: 'load' },
  null, null, null, null,
];

function loadQuick() {
  try {
    const raw = JSON.parse(localStorage.getItem('nw.quick') || 'null');
    if (!Array.isArray(raw)) return [...DEFAULT_QUICK];
    const slots = new Array(QUICK_SLOTS).fill(null);
    for (let i = 0; i < QUICK_SLOTS; i += 1) slots[i] = raw[i] ?? null;
    return slots;
  } catch {
    return [...DEFAULT_QUICK];
  }
}

let quickSlots = loadQuick();

const SKILL_FALLBACK = {
  'core.take': '拾取',
  'core.drop': '放下',
  'core.wait': '等待',
  'core.attack': '劈砍',
  'core.cast': '蓄力',
  'core.use': '使用',
};

function quickLabel(entry) {
  if (entry === null) return '';
  if (entry.kind === 'skill') {
    const skill = hotbarSkills.find((row) => row.tag === entry.ref);
    return skill ? skill.name : (SKILL_FALLBACK[entry.ref] ?? entry.ref);
  }
  return { inventory: '背包', settings: '设置', save: '存档', load: '读档' }[entry.ref] ?? entry.ref;
}

function activateQuick(index) {
  const entry = quickSlots[index];
  if (entry === null) return;
  if (entry.kind === 'skill') { useSkill(entry.ref); return; }
  if (entry.ref === 'inventory') toggleInventory();
  else if (entry.ref === 'settings') openSettings();
  else if (entry.ref === 'save') api('/api/save', {}).then((next) => { if (lastState !== null) render(next); });
  else if (entry.ref === 'load') api('/api/load', {}).then((next) => { if (lastState !== null) render(next); });
}

/** 小地图：把当前空间压成一张缩略图，玩家蓝、其他红。 */
function renderMinimap(state) {
  const box = document.getElementById('minimap');
  if (box === null) return;

  const space = (state.snapshot.spaces || [])[0];
  if (space === undefined) return;

  const cell = 4;
  const size = minimapSize(space, cell);
  const marks = (state.snapshot.entities || [])
    .filter((entity) => entity.x !== undefined && entity.y !== undefined)
    .map((entity) => ({
      x: entity.x,
      y: entity.y,
      color: entity.handle === state.playerHandle ? "#8ab4f8" : "#c96a5a",
    }));

  mount(box, canvasNode(size.width, size.height, (context) => {
    drawMinimap(context, { space, cell, marks });
  }));
}

function renderQuick() {
  const cells = quickSlots.map((entry, index) => {
    const label = quickLabel(entry);
    const node = button(label, () => activateQuick(index));
    node.style.width = config.hotbarCell + 'px';
    node.style.height = config.hotbarCell + 'px';
    node.style['font-size'] = '10px';
    node.style.padding = '0';
    node.style['border-radius'] = '0';
    node.style.border = '1px solid #2a303c';
    node.style.background = entry ? '#1d2432' : 'transparent';

    return withEvents(node, {
      dragover: (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; },
      drop: (event) => {
        event.preventDefault();
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        quickSlots[index] = { kind: data.kind, ref: data.ref };
        localStorage.setItem('nw.quick', JSON.stringify(quickSlots));
        renderEquip();
  renderQuick();
      },
      contextmenu: (event) => {
        event.preventDefault();
        quickSlots[index] = null;
        localStorage.setItem('nw.quick', JSON.stringify(quickSlots));
        renderQuick();
      },
    });
  });

  mount(document.getElementById('quick'), grid({ columns: QUICK_COLUMNS, cell: config.hotbarCell, gap: 0 }, ...cells));
}

renderQuick();

function renderEquip() {
  const box = document.getElementById('equip');
  if (box === null) return;
  box.textContent = '';
  for (let i = 0; i < 6; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    box.appendChild(slot);
  }
}

function activateSlot(index) {
  const entry = hotbarSlots[index];
  if (entry === null) {
    document.getElementById('message').textContent = '这个槽是空的：从背包拖一个技能或道具上来。';
    return;
  }
  if (entry.kind === 'skill') {
    if (!hotbarSkills.some((skill) => skill.tag === entry.ref)) {
      document.getElementById('message').textContent = '这个技能现在不可用（规则被关掉了）。';
      return;
    }
    useSkill(entry.ref, undefined, undefined, {});
  }
  else useSkill('core.use', undefined, undefined, { item: entry.ref });
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

/** 玩家现在站在哪（快照里找自己）。 */
function playerCell(state) {
  const me = (state.snapshot.entities || []).find((entity) => entity.handle === state.playerHandle);
  if (me === undefined || me.x === undefined || me.y === undefined) return null;
  return { x: me.x, y: me.y };
}

async function act(dir) {
  render(await api('/api/act', { dir }));
}
async function useSkill(tag, x, y, extra = {}) {
  const body = x === undefined ? { tag } : { tag, x, y };
  if (extra.item !== undefined) body.item = extra.item;
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
  if (renderer === null || lastState === null) return;
  const cell = cellAt(event);
  const me = playerCell(lastState);

  // 点自己脚下：捡东西（这就是「拾取键」）
  if (me !== null && me.x === cell.x && me.y === cell.y) {
    useSkill('core.take');
    return;
  }

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

let capturingBinding = false;
let settingsPage = 'root';

async function openSettings(page = 'root') {
  settingsPage = page;
  const box = document.getElementById('settings');
  box.hidden = false;
  box.textContent = '';

  const back = button('← 返回', () => openSettings('root'));
  let body;

  if (page === 'root') {
    body = col({ gap: 8, width: 220 },
      button('配置', () => openSettings('config')),
      button('按键', () => openSettings('keys')),
      button('世界', () => openSettings('world')),
      button('存档 / 读档', () => openSettings('saves')),
      button('关闭 Esc', () => closeSettings()),
    );
  } else if (page === 'config') {
    const cellRow = (label, key) => {
      const value = config[key];
      return row({ gap: 6, align: 'center' },
        text(label, { policy: 'fixed', width: 96 }),
        button('−', () => { config = withConfig(config, { [key]: clampCell(value - 4) }); saveConfig(config); refreshSizes(); openSettings('config'); }),
        text(String(value), { policy: 'fixed', width: 40 }),
        button('+', () => { config = withConfig(config, { [key]: clampCell(value + 4) }); saveConfig(config); refreshSizes(); openSettings('config'); }),
      );
    };

    body = col({ gap: 8 },
      cellRow('快捷栏格子', 'hotbarCell'),
      cellRow('背包格子', 'inventoryCell'),
      row({ gap: 6, align: 'center' },
        text('开发者模式', { policy: 'fixed', width: 96 }),
        button(config.devMode ? '开' : '关', () => {
          config = withConfig(config, { devMode: !config.devMode });
          saveConfig(config);
          applyDevMode();
  renderQuick();
          openSettings('config');
        }),
      ),
      back,
    );
  } else if (page === 'keys') {
    const rows = Object.entries(config.bindings).map(([code, command]) =>
      row({ gap: 6, align: 'center' },
        text(code, { policy: 'fixed', width: 96 }),
        text(command, { policy: 'fixed' }),
        button('改', () => { capturingBinding = code; openSettings('keys'); }),
      ),
    );

    body = col({ gap: 6 },
      text(capturingBinding ? '按下新的键…（Esc 取消）' : '点「改」再按一个键', { policy: 'fixed' }),
      ...rows,
      back,
    );
  } else if (page === 'world') {
    const info = lastState === null ? '（未开局）'
      : '世界 ' + (lastState.world || '?') + ' · 种子 ' + lastState.seed + ' · tick ' + lastState.tick;
    body = col({ gap: 8 },
      text(info, { policy: 'fixed' }),
      back,
    );
  } else {
    body = col({ gap: 8 },
      row({ gap: 8 },
        button('存档', async () => { render(await api('/api/save', {})); openSettings('saves'); }),
        button('读档', async () => { render(await api('/api/load', {})); openSettings('saves'); }),
      ),
      back,
    );
  }

  const titles = { root: '设置', config: '配置', keys: '按键', world: '世界', saves: '存档 / 读档' };
  box.appendChild(renderNode(modal(body, { title: titles[page] ?? '设置' })));
}

function closeSettings() {
  const box = document.getElementById('settings');
  box.hidden = true;
  box.textContent = '';
}

function refreshSizes() {
  INVENTORY_CELL = config.inventoryCell;
  HOTBAR_CELL = config.hotbarCell;
  INVENTORY_COLUMNS = config.inventoryColumns;
  if (lastState !== null) renderHotbar(lastState);
}

function applyDevMode() {
  const panel = document.getElementById('devpanel');
  if (panel !== null) panel.hidden = !config.devMode;
}

document.getElementById('settingsbtn').addEventListener('click', () => {
  const box = document.getElementById('settings');
  if (box.hidden) openSettings(); else closeSettings();
});

window.addEventListener('keydown', (event) => {
  if (capturingBinding !== false) {
    const oldCode = capturingBinding;
    capturingBinding = false;
    if (event.code !== 'Escape') {
      const command = config.bindings[oldCode];
      if (command !== undefined) {
        // 把旧键的命令搬到新键上（旧键解绑）
        const without = withBinding(config, oldCode, null);
        config = withConfig(without, { bindings: { ...without.bindings, [event.code]: command } });
        saveConfig(config);
      }
    }
    openSettings();
    return;
  }

  const command = commandFor(bindings(), event.code);
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
  applyDevMode();
})();
</script>
</html>`;

/** 结构面板用的元素在启动器页里，这里只导出页面本身。 */
export const PAGES = { LAUNCHER_PAGE, GAME_PAGE };
