import { api } from '/client/shared.js';
import { attach } from '/web/game/systems/render/browser.js';
import { row, col, text, button, toggle, modal, panel, grid, bar, canvasNode, withEvents } from '/web/game/systems/ui/spec.js';
import { clampCell, clampChargeMs, clampFrameMs, loadConfig, saveConfig, withBinding, withConfig } from '/web/game/systems/config/config.js';
import { commandFor, parseCommand } from '/web/game/systems/input/bindings.js';
import { mount, render as renderNode } from '/web/game/systems/ui/dom.js';
import { closePolicy, renderQuickbar } from '/client/hud/quickbar.js';
import { renderStatus } from '/client/hud/status.js';
import { renderMinimap } from '/client/hud/minimap.js';
import { createAimTracker } from '/client/hud/aim.js';


// 游戏页面不该有浏览器的默认权力：拖拽不要导航、右键不要菜单、文字不要选中
// 右键取消：优先关弱窗口，其次取消选目标（场景/背包仍走 Esc）
document.addEventListener('contextmenu', (event) => {
  const policy = document.getElementById('policy');
  if (policy !== null && !policy.hidden) {
    event.preventDefault();
    closePolicy();
    return;
  }
  if (cancelSelection()) {
    event.preventDefault();
  }
});

document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('selectstart', (event) => {
  if (event.target instanceof HTMLElement && event.target.tagName !== 'INPUT') event.preventDefault();
});

const params = new URLSearchParams(location.search);
const worldId = params.get('world');

/** 开始菜单里选的选项（种子之外的东西）。 */
const startOptions = (() => {
  try {
    return JSON.parse(params.get('options') || '{}');
  } catch {
    return {};
  }
})();
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
  for (const key of ['nw.hotbar']) {
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


/**
 * 统一的「选目标」：所有需要目标的技能都走这里。
 *   selection = { tag, label }
 * 鼠标移动用它预览，点击提交，右键取消（Esc 也认，但提示按右键写）。
 */
let selection = null;

/** 有没有动作请求在途：在途时忽略新的移动，避免连点叠太多。 */
let acting = false;

/** 瞄准高亮：外部模块负责「记住了什么、什么时候重算」。 */
const aim = createAimTracker({
  request: (tag, x, y) => api('/api/aim', { tag, x, y }),
  apply: (cells) => {
    if (renderer !== null) renderer.setAim(cells);
  },
});

/** 这个技能要不要先选目标？ */
function needsTarget(skill) {
  return skill.target !== undefined && skill.target.kind !== 'self';
}

function beginSelection(tag, label) {
  selection = { tag, label };
  aim.setTag(tag);
  const box = document.getElementById('message');
  if (box) box.textContent = '选择目标：' + label + '（右键取消）';
}

function cancelSelection() {
  if (selection === null) return false;
  selection = null;
  aim.setTag(null);
  const box = document.getElementById('message');
  if (box) box.textContent = '取消';
  return true;
}
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
  // 读档失败时后端返回的是 { ok:false, error }，没有 snapshot——别硬画
  if (state === null || state === undefined || state.snapshot === undefined) {
    const box = document.getElementById('errbar');
    if (box) {
      box.hidden = false;
      box.textContent = (state && state.error) ? String(state.error) : '没有拿到世界状态';
    }
    return;
  }

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

  if (uiFocus !== null || state.dead) {
    aim.clear();
  } else {
    aim.refresh();
  }

  scheduleChargeTick();

  renderMinimap(state);
  renderDialog(state);

  renderStatus(state);

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
  aim.refresh();
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

/**
 * 右下角 3×4：点击策略面板。
 *
 * 四行 = 敌对 / 中立 / 友好 / 物品；三列 = 可选动作。
 * 点一下立即生效并存进 config，刷新还在。
 */

function activateSlot(index) {
  const entry = hotbarSlots[index];
  if (entry === null) {
    document.getElementById('message').textContent = '这个槽是空的：从背包拖一个技能或道具上来。';
    return;
  }
  if (entry.kind === 'skill') {
    const skill = hotbarSkills.find((row) => row.tag === entry.ref);
    if (skill === undefined) {
      document.getElementById('message').textContent = '这个技能现在不可用（规则被关掉了）。';
      return;
    }
    if (needsTarget(skill)) {
      beginSelection(skill.tag, skill.name);
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


/** 快照里这一格站着的第一个非玩家单位。 */
function entityAtCell(cell) {
  if (lastState === null) return null;
  const entity = (lastState.snapshot.entities || []).find(
    (row) => row.handle !== lastState.playerHandle && row.x === cell.x && row.y === cell.y,
  );
  return entity ?? null;
}

function dispositionOf(entity) {
  const component = entity.components && entity.components['core.disposition'];
  const value = component && component.value;
  return value === 'hostile' || value === 'friendly' ? value : 'neutral';
}

function isItem(entity) {
  return Boolean(entity.components && entity.components['core.item']);
}

function hasDialog(entity) {
  return Boolean(entity.components && entity.components['core.dialog']);
}


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

/** 传给区域模块的上下文：它们不直接碰 config 与网络。 */
function hudContext() {
  return {
    // 用 getter：调用方每次拿到的都是当前值，不会拿到过期快照
    get clickPolicy() {
      return config.clickPolicy;
    },
    get skills() {
      return lastState === null ? [] : lastState.skills.filter((skill) => skill.tag !== 'core.move');
    },
    setClickPolicy(key, action) {
      config = withConfig(config, { clickPolicy: { ...config.clickPolicy, [key]: action } });
      saveConfig(config);
      refreshHud();
    },
    useSkill,
    beginSelection,
    needsTarget,
  };
}

/** 重画所有常驻区域。 */
function refreshHud() {
  renderQuickbar(hudContext());
  renderEquip();
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
  // 一次只发一个动作：连着发会让世界跳着推进
  if (acting) return;
  acting = true;
  try {
    await playFrames(await api('/api/act', { dir }));
  } finally {
    acting = false;
  }
}
/** 把一帧增量套到当前状态上（浅拷贝，不动 lastState 本体）。 */
function applyFrame(state, frame) {
  const entities = (state.snapshot.entities || []).map((entity) => ({ ...entity }));
  const byHandle = new Map(entities.map((entity) => [entity.handle, entity]));

  for (const move of frame.moves || []) {
    const entity = byHandle.get(move.handle);
    if (entity === undefined) continue;
    if (move.removed) {
      const index = entities.indexOf(entity);
      if (index >= 0) entities.splice(index, 1);
      continue;
    }
    entity.x = move.x;
    entity.y = move.y;
  }

  for (const change of frame.hp || []) {
    const entity = byHandle.get(change.handle);
    if (entity === undefined) continue;
    const health = entity.components ? entity.components['core.health'] : undefined;
    entity.components = { ...(entity.components || {}), 'core.health': { ...(health || {}), hp: change.hp } };
  }

  return { ...state, snapshot: { ...state.snapshot, entities } };
}

/** 有帧就逐帧播，没有就直接画。 */
async function playFrames(result) {
  const frames = result && result.frames;
  if (!Array.isArray(frames) || frames.length === 0) {
    render(result);
    return;
  }

  const box = document.getElementById('message');
  let working = result;

  // 短动作压短间隔：移动这种一帧一帧慢慢播会显得「卡手」
  const perFrame = frames.length <= 3 ? Math.min(config.frameMs, 55) : config.frameMs;

  for (const frame of frames) {
    working = applyFrame(working, frame);

    // 播放期间只重画画布：HUD / 小地图 / 提示条等播完再统一刷新，
    // 否则每帧都重建一次，数字会闪。
    if (renderer !== null) renderer.setState(working);
    renderStatus(working); // tick 与血量跟着帧走，不然状态栏会落后

    if (box && Array.isArray(frame.events) && frame.events.length > 0) box.textContent = frame.events[0];
    await new Promise((resolve) => setTimeout(resolve, perFrame));
  }

  render(result);
}
async function useSkill(tag, x, y, extra = {}) {
  const body = x === undefined ? { tag } : { tag, x, y };
  if (extra.item !== undefined) body.item = extra.item;
  if (acting) return;
  acting = true;
  try {
    await playFrames(await api('/api/skill', body));
  } finally {
    acting = false;
  }
}


// 点别处就关弱窗口（它不抢焦点，所以靠自己监听）
document.addEventListener('pointerdown', (event) => {
  const box = document.getElementById('policy');
  if (box === null || box.hidden) return;
  const target = event.target;
  if (target instanceof Element && target.closest('#policy')) return;
  if (target instanceof Element && target.closest('#quick')) return;
  closePolicy();
});

document.getElementById('map').addEventListener('mousemove', (event) => {
  if (renderer === null) return;
  const now = Date.now();
  if (now - aimTimer < 40) return;
  aimTimer = now;

  const cell = cellAt(event);
  renderer.setCursor(cell);
  aim.setHover(cell);
  api('/api/inspect', { x: cell.x, y: cell.y }).then((info) => {
    showTooltip(info, event.clientX, event.clientY);
  });
});

/** 鼠标位置 → 格子（扣掉画布偏移，再交给渲染器换算相机）。 */
/** 蓄力期间自动推进：每 200ms 点一次等待，让人看得见。 */
// 节奏来自设置（config.chargeTickMs），默认 400ms
let chargeTimer = null;

function scheduleChargeTick() {
  clearTimeout(chargeTimer);
  chargeTimer = null;

  const pending = lastState === null ? null : lastState.pending;
  if (!pending || pending.remaining <= 0) return;
  if (uiFocus !== null || selection !== null) return;

  chargeTimer = setTimeout(() => {
    if (acting) {
      scheduleChargeTick();
      return;
    }
    useSkill('core.wait');
  }, config.chargeTickMs);
}
function cellAt(event) {
  const map = document.getElementById('map');
  const rect = map.getBoundingClientRect();
  return renderer.cellAt(event.clientX - rect.left, event.clientY - rect.top);
}

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
    aim.clear();
    renderer.setCursor(null);
  }
});

document.getElementById('map').addEventListener('click', (event) => {
  if (renderer === null || lastState === null || uiFocus !== null) return;
  const cell = cellAt(event);
  const me = playerCell(lastState);

  if (selection !== null) {
    const tag = selection.tag;
    selection = null;
    useSkill(tag, cell.x, cell.y);
    // 用完了就把高亮恢复到「默认攻击」，否则范围框会一直留着
    aim.setTag(null);
    aim.setHover(cell);
    return;
  }

  // 点别人：按「操作组」的默认行为决定
  const target = entityAtCell(cell);
  if (target !== null && isItem(target)) {
    const itemAction = config.clickPolicy.item;
    if (itemAction.kind === 'builtin' && itemAction.ref === 'take') {
      const me = playerCell(lastState);
      if (me !== null && me.x === cell.x && me.y === cell.y) {
        useSkill('core.take');
      } else {
        document.getElementById('message').textContent = '走过去才能捡起来。';
      }
    } else if (itemAction.kind === 'skill') {
      useSkill(itemAction.ref, cell.x, cell.y);
    }
    return;
  }

  if (target !== null) {
    const disposition = dispositionOf(target);
    const action = config.clickPolicy[disposition] ?? { kind: 'builtin', ref: 'inspect' };

    // 没有血的不是战斗目标（箱子、掉在地上的东西）——只观察
    const living = Boolean(target.components && target.components['core.health']);

    if (action.kind === 'builtin') return; // inspect：只看，不动手

    // 技能：谈不了话就退回劈砍（只有一个技能时它才叫 base.talk）
    if (action.ref === 'base.talk' && !hasDialog(target)) {
      if (living) useSkill('base.attack', cell.x, cell.y);
      return;
    }
    if (!living && action.ref !== 'base.talk') return;

    useSkill(action.ref, cell.x, cell.y);
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
      (() => {
        const value = config.chargeTickMs;
        const set = (next) => {
          config = withConfig(config, { chargeTickMs: clampChargeMs(next) });
          saveConfig(config);
          openSettings('config');
        };
        return row({ gap: 6, align: 'center' },
          text('蓄力节奏', { policy: 'fixed', width: 96 }),
          button('-', () => set(value - 50)),
          text(String(value) + 'ms', { policy: 'fixed', width: 64 }),
          button('+', () => set(value + 50)),
        );
      })(),
      cellRow('背包格子', 'inventoryCell'),
      (() => {
        const value = config.frameMs;
        const set = (next) => {
          config = withConfig(config, { frameMs: clampFrameMs(next) });
          saveConfig(config);
          openSettings('config');
        };
        return row({ gap: 6, align: 'center' },
          text('帧节奏', { policy: 'fixed', width: 96 }),
          button('-', () => set(value - 10)),
          text(String(value) + 'ms', { policy: 'fixed', width: 64 }),
          button('+', () => set(value + 10)),
        );
      })(),
      row({ gap: 6, align: 'center' },
        text('开发者模式', { policy: 'fixed', width: 96 }),
        button(config.devMode ? '开' : '关', () => {
          config = withConfig(config, { devMode: !config.devMode });
          saveConfig(config);
          applyDevMode();
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
        button('读档', async () => {
      const result = await api('/api/load', {});
      if (result && result.ok === false) {
        const box = document.getElementById('errbar');
        if (box) { box.hidden = false; box.textContent = '读档失败：' + (result.error || '未知'); }
        return;
      }
      render(result);
      openSettings('saves');
    }),
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
  aim.refresh();
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
  // 长按的重复事件一律丢掉：一次按键 = 一次动作
  if (event.repeat) return;

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

  // Esc：从最内层开始收——先取消选目标，再退场景，再关窗口，最后才开设置
  if (event.code === 'Escape') {
    if (cancelSelection()) return;
    if (lastState !== null && lastState.scene && lastState.scene.id !== 'explore') {
      sceneCommand('close');
      return;
    }
    if (uiFocus === 'inventory') { closeInventory(); return; }
    if (uiFocus === 'settings') { closeSettings(); return; }
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

  // 场景在跑（对话）：数字键选选项、Esc 离开
  if (lastState !== null && lastState.scene && lastState.scene.id !== 'explore') {
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
    beginSelection('base.talk', '交谈');
    return;
  }
  if (parsed.kind === 'move') {
    act(parsed.value);
    // 按住方向键 = 固定节奏地再走（松手停）。节奏由我们定，不受系统重复率影响。
    held = { code: event.code, dir: parsed.value };
    startHoldRepeat();
  } else if (parsed.kind === 'skill') {
    useSkill(parsed.value);
  }
});

/** 按住方向键时的重复间隔（毫秒）。 */
const HOLD_REPEAT_MS = 110;

let held = null;
let holdTimer = null;

function startHoldRepeat() {
  if (holdTimer !== null) return;
  holdTimer = setInterval(() => {
    if (held === null) return;
    act(held.dir);
  }, HOLD_REPEAT_MS);
}

function stopHoldRepeat(code) {
  // code 为空 = 失焦/切页面，无条件停
  if (code !== '' && held !== null && held.code !== code) return;
  held = null;
  if (holdTimer !== null) {
    clearInterval(holdTimer);
    holdTimer = null;
  }
}

window.addEventListener('keyup', (event) => stopHoldRepeat(event.code));
window.addEventListener('blur', () => stopHoldRepeat(''));

(async () => {
  if (!worldId) {
    document.getElementById('errbar').hidden = false;
    document.getElementById('errbar').textContent = '没有指定世界：请从启动器进入。';
    return;
  }
  // 读档流程已经建好会话，直接用；否则按选择开局。
  let state = await api('/api/state');
  if (!state || state.launcher) {
    state = await api('/api/start', { id: worldId, off, seed, options: startOptions });
  }
  if (!state || state.launcher) {
    document.getElementById('errbar').hidden = false;
    document.getElementById('errbar').textContent = '世界载入失败：' + (state && state.errors && state.errors[0] ? state.errors[0].error : '未知');
    return;
  }
  stateSkills = state.skills;
  hotbarItems = (await api('/api/inventory')).items || [];
  refreshHud();
  render(state);
  applySettings();
  applyPortraitCollapsed();
  applyDevMode();
})();
