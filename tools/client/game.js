import { api } from '/client/shared.js';
import { attach } from '/web/game/systems/render/browser.js';
import { row, col, text, button, toggle, modal, grid, bar, canvasNode, withEvents } from '/web/game/systems/ui/spec.js';
import { drawMinimap, minimapSize } from '/web/game/systems/ui/minimap.js';
import { clampCell, loadConfig, saveConfig, withBinding, withConfig } from '/web/game/systems/config/config.js';
import { commandFor, parseCommand } from '/web/game/systems/input/bindings.js';
import { mount, render as renderNode } from '/web/game/systems/ui/dom.js';


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

// 旧 tag → 新 tag（改过一次命名：core.attack/cast → base.*）
const LEGACY_TAGS = { 'core.attack': 'base.attack', 'core.cast': 'base.cast' };
function migrateTag(tag) {
  return LEGACY_TAGS[tag] ?? tag;
}

/** 把浏览器的旧引用一次性迁移掉——启动时做，别等到用户点。 */
function migrateLocalState() {
  for (const key of ['nw.hotbar', 'nw.quick']) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      if (!Array.isArray(raw)) continue;
      const next = raw.map((entry) =>
        entry !== null && entry.kind === 'skill' ? { ...entry, ref: migrateTag(entry.ref) } : entry,
      );
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // 坏的直接留着，读的时候会当空槽处理
    }
  }

  try {
    const off = JSON.parse(localStorage.getItem('nw.off') || '[]');
    if (Array.isArray(off)) localStorage.setItem('nw.off', JSON.stringify(off.map(migrateTag)));
  } catch {
    // 同上
  }
}

migrateLocalState();

/** 当前独占输入的窗口：null = 游戏本体。 */
let uiFocus = null;

/** 正在选目标的技能（E 说话、以后的法术）。 */
let pendingSkill = null;
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
  renderDialog(state);

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
  if (uiFocus === 'settings') closeSettings();
  if (lastState !== null) hotbarSkills = lastState.skills.filter((skill) => skill.tag !== 'core.move');
  const box = document.getElementById('inventory');
  uiFocus = 'inventory';
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
  uiFocus = null;
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
  // 每次都从最新快照里取，不缓存——规则被关掉后要立刻反映
  hotbarSkills = state.skills.filter((skill) => skill.tag !== 'core.move');

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
  { kind: 'skill', ref: 'base.attack' },
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
  'base.attack': '劈砍',
  'base.cast': '蓄力',
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

/** 对话场景：和背包一样是面板，但输入归它。 */
function renderDialog(state) {
  const box = document.getElementById('dialog');
  if (box === null) return;

  const scene = state.scene;
  if (!scene || scene.id !== 'dialog' || scene.view === null) {
    box.hidden = true;
    box.textContent = '';
    return;
  }

  const choices = (scene.view.choices || []).map((label, index) =>
    button((index + 1) + ' ' + label, () => sceneCommand('choice' + (index + 1))),
  );

  const body = col({ gap: 8 },
    text(scene.view.text || '', { policy: 'fixed' }),
    row({ gap: 6, 'flex-wrap': 'wrap' }, ...choices),
    row({ gap: 6, justify: 'end' }, button('离开 Esc', () => sceneCommand('close'))),
  );

  box.textContent = '';
  box.appendChild(renderNode(modal(body, { title: '对话' })));
  box.hidden = false;
}

async function sceneCommand(command) {
  render(await api('/api/scene/command', { command }));
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
  api('/api/aim', { tag: pendingSkill ?? 'base.attack', x: cell.x, y: cell.y }).then((result) => {
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
  if (renderer === null || lastState === null || uiFocus !== null) return;
  const cell = cellAt(event);
  const me = playerCell(lastState);

  if (pendingSkill !== null) {
    const tag = pendingSkill;
    pendingSkill = null;
    useSkill(tag, cell.x, cell.y);
    return;
  }

  // 点自己脚下：捡东西（这就是「拾取键」）
  if (me !== null && me.x === cell.x && me.y === cell.y) {
    useSkill('core.take');
    return;
  }

  useSkill('base.attack', cell.x, cell.y);
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
  if (uiFocus === 'inventory') closeInventory();
  const box = document.getElementById('settings');
  uiFocus = 'settings';
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
  uiFocus = null;
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

  if (pendingSkill !== null && event.code === 'Escape') {
    pendingSkill = null;
    document.getElementById('message').textContent = '取消';
    return;
  }

  // 场景在跑（对话）：数字键选选项、Esc 离开
  if (lastState !== null && lastState.scene && lastState.scene.id !== 'explore') {
    if (event.code === 'Escape') { sceneCommand('close'); return; }
    const pick = event.code.match(/^Digit([1-9])$/);
    if (pick !== null) { sceneCommand('choice' + pick[1]); return; }
    return;
  }

  // 有焦点窗口：输入归它，游戏本体不响应
  if (uiFocus !== null) {
    if (event.code === 'Escape') {
      if (uiFocus === 'inventory') closeInventory();
      else if (uiFocus === 'settings') closeSettings();
      return;
    }
    if (uiFocus === 'inventory' && event.code === 'KeyI') { closeInventory(); return; }
    return;
  }

  const digit = event.code.match(/^Digit([1-9])$/);
  if (digit !== null) {
    activateSlot(Number(digit[1]) - 1);
    return;
  }

  if (!document.getElementById('settings').hidden) return;
  if (parsed.kind === 'ui' && parsed.value === 'talk') {
    pendingSkill = 'base.talk';
    document.getElementById('message').textContent = '选择要交谈的人（Esc 取消）';
    return;
  }
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
