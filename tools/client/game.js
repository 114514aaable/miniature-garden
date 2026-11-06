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
import { createSettingsWindow } from '/client/windows/settings.js';
import { createInventoryWindow } from '/client/windows/inventory.js';


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

/** 设置窗口：实现搬到了 windows/settings.js，宿主只给上下文。 */
let settingsWindow = null;

function settingsContext() {
  return {
    api,
    renderState: (state) => render(state),
    getConfig: () => config,
    setConfig: (next) => { config = next; },
    getLastState: () => lastState,
    getFocus: () => uiFocus,
    setFocus: (name) => { uiFocus = name; },
    closeInventory: () => closeInventory(),
    refreshAim: () => aim.refresh(),
    refreshSizes: () => refreshSizes(),
    getRenderer: () => renderer,
    showError: (text) => {
      const box = document.getElementById('errbar');
      if (box) { box.hidden = false; box.textContent = text; }
    },
  };
}

function settingsUI() {
  settingsWindow ??= createSettingsWindow(settingsContext());
  return settingsWindow;
}

function openSettings(page = 'root') { settingsUI().open(page); }
function closeSettings() { settingsUI().close(); }
function applySettings() { settingsUI().apply(); }
function applyDevMode() { settingsUI().applyDevMode(); }


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

let lastState = null;

/** 背包窗口：实现搬到了 windows/inventory.js。 */
let inventoryWindow = null;

function inventoryContext() {
  return {
    api,
    getConfig: () => config,
    getFocus: () => uiFocus,
    setFocus: (name) => { uiFocus = name; },
    closeSettings: () => closeSettings(),
    refreshAim: () => aim.refresh(),
    getLastState: () => lastState,
    getHotbarSlots: () => hotbarSlots,
    hotbarColumns: () => HOTBAR_COLUMNS,
    hotbarLabel: (entry) => hotbarLabel(entry),
    setHotbarSlot: (index, entry) => {
      hotbarSlots[index] = entry;
      saveHotbar(hotbarSlots);
      if (lastState !== null) renderHotbar(lastState);
    },
  };
}

function inventoryUI() {
  inventoryWindow ??= createInventoryWindow(inventoryContext());
  return inventoryWindow;
}

function openInventory() { return inventoryUI().open(); }
function closeInventory() { inventoryUI().close(); }
function toggleInventory() { inventoryUI().toggle(); }
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
/** 把一帧按 handle 合并进状态（整条记录覆盖，不挑字段）。 */
function applyFrame(state, frame) {
  const entities = (state.snapshot.entities || []).map((entity) => ({ ...entity }));
  const at = new Map(entities.map((entity, index) => [entity.handle, index]));

  for (const record of frame.entities || []) {
    const index = at.get(record.handle);
    if (index === undefined) {
      at.set(record.handle, entities.length);
      entities.push(record);
    } else {
      entities[index] = record;
    }
  }

  for (const handle of frame.removed || []) {
    const index = at.get(handle);
    if (index !== undefined) entities.splice(index, 1);
  }

  // 血条/名字从玩家实体上取，不依赖 state.hud 的旧值
  const player = entities.find((entity) => entity.handle === state.playerHandle);
  const health = player && player.components ? player.components['core.health'] : undefined;
  const hud =
    health === undefined
      ? state.hud
      : { ...state.hud, hp: health.hp, hpMax: health.max };

  return { ...state, tick: frame.tick, hud, snapshot: { ...state.snapshot, entities } };
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

  // 底部文字用服务端给的说明（「走一步（2 回合）」），不要吐事件原文
  if (box && typeof result.message === 'string' && result.message.length > 0) box.textContent = result.message;

  for (const frame of frames) {
    working = applyFrame(working, frame);

    // 播放期间只重画画布：HUD / 小地图 / 提示条等播完再统一刷新，
    // 否则每帧都重建一次，数字会闪。
    if (renderer !== null) renderer.setState(working);
    renderStatus(working); // tick 与血量跟着帧走，不然状态栏会落后

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

function refreshSizes() {
  // 格子尺寸都在 config 里，画的时候现取；这里只需要重画一次快捷栏
  if (lastState !== null) renderHotbar(lastState);
}


document.getElementById('settingsbtn').addEventListener('click', () => {
  const box = document.getElementById('settings');
  if (box.hidden) openSettings(); else closeSettings();
});

window.addEventListener('keydown', (event) => {
  // 长按的重复事件一律丢掉：一次按键 = 一次动作
  if (event.repeat) return;

  // 设置窗口正在等按键：交给它处理
  if (settingsWindow !== null && settingsWindow.handleKeyCapture(event.code)) return;

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
  // ?instance=xxx：沿用已有的世界实例（最近的世界 → 继续）
  const instanceId = params.get('instance');
  if (instanceId !== null && instanceId !== '') {
    const resumed = await api('/api/start', { instanceId });
    render(resumed);
    applySettings();
    applyPortraitCollapsed();
    applyDevMode();
    return;
  }

  // fresh=1（从启动器点开始）→ 无条件开新局；否则刷新页面时接上正在跑的那局
  const fresh = params.get('fresh') === '1';
  let state = fresh ? null : await api('/api/state');
  if (!state || state.launcher) {
    state = await api('/api/start', { id: worldId, off, seed, options: startOptions });
  }
  if (!state || state.launcher) {
    document.getElementById('errbar').hidden = false;
    document.getElementById('errbar').textContent = '世界载入失败：' + (state && state.errors && state.errors[0] ? state.errors[0].error : '未知');
    return;
  }
  hotbarItems = (await api('/api/inventory')).items || [];
  refreshHud();
  render(state);
  applySettings();
  applyPortraitCollapsed();
  applyDevMode();
})();
