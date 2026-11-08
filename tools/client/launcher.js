import { modal, col, row, text, button, input, field } from '/web/game/systems/ui/spec.js';
import { mount } from '/web/game/systems/ui/dom.js';
import { api } from '/client/shared.js';


const KIND_ORDER = [
  ['rule', '规则'], ['component', '组件'], ['template', '模板'],
  ['terrain', '地形'], ['space', '空间'], ['entity', '实体'], ['world', '世界'],
];

let worlds = [];
let activeWorld = localStorage.getItem('nw.world') || null;
let inspecting = null;

function show(id) {
  for (const panel of ['packs', 'settings', 'quit', 'recent']) {
    const box = document.getElementById(panel);
    if (box !== null) box.hidden = panel !== id;
  }
  // 菜单保持可见：面板是浮层，不是换页
  document.getElementById('menu').style.opacity = id === null ? '1' : '0.35';
}

function renderWorlds() {
  const list = document.getElementById('worlds');
  list.textContent = '';

  for (const world of worlds) {
    const row = document.createElement('div');
    row.className = 'world' + (world.id === activeWorld ? ' picked' : '') + (world.ok ? '' : ' bad') + (world.root ? '' : ' dep');

    const info = document.createElement('div');
    if (world.description) {
      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = world.description;
      info.appendChild(desc);
    }
    const name = document.createElement('div');
    name.className = 'name';
    const needs = (world.requires || []).length > 0 ? '  →  需要 ' + world.requires.join(' + ') : '';
    name.textContent = (world.name || world.id) + '  @' + world.version + needs;
    info.appendChild(name);
    const packs = document.createElement('div');
    packs.className = 'packs';
    packs.textContent = world.root
      ? (world.packs || []).join(' + ')
      : '依赖包（不能单独开始）';
    info.appendChild(packs);
    if (!world.ok) {
      const error = document.createElement('div');
      error.className = 'error';
      error.textContent = world.error;
      info.appendChild(error);
    }
    row.appendChild(info);

    const actions = document.createElement('div');
    if (world.root) {
      const pick = document.createElement('button');
      pick.textContent = world.id === activeWorld ? '已选' : '选择';
      pick.disabled = !world.ok;
      pick.addEventListener('click', () => {
        activeWorld = world.id;
        localStorage.setItem('nw.world', world.id);
        renderWorlds();
      });
      actions.appendChild(pick);
    }

    const graph = document.createElement('button');
    graph.textContent = '结构';
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

/**
 * 开始游戏：选项由世界包声明（world.json 的 startMenu），这里只负责画。
 *
 * 现在支持两种字段：
 *   number  数字输入
 *   select  下拉（一排按钮）
 */
/** 绑事件：元素不存在就跳过（模板改了也不至于整页崩）。 */
function on(id, handler) {
  const node = document.getElementById(id);
  if (node === null) {
    console.warn('缺少元素：' + id);
    return;
  }
  node.addEventListener('click', handler);
}

function openStartDialog(world, preset = null) {
  const existing = document.getElementById('seedbox');
  if (existing) existing.remove();

  const fields = (world.startMenu && world.startMenu.fields) || [{ key: 'seed', label: '种子', type: 'number', default: 0 }];
  const values = { ...(preset || {}) };

  const controls = fields.map((item) => {
    const saved = item.key === 'seed' ? localStorage.getItem('nw.seed') : localStorage.getItem('nw.' + item.key);
    const initial = values[item.key] ?? (saved !== null && saved !== '' ? saved : item.default);
    if (item.type === 'select') {
      // 存的旧值可能已经不在选项里：回退到默认/第一项
      const options = (item.values || []).map(String);
      const wanted = String(initial ?? '');
      values[item.key] = options.includes(wanted) ? wanted : String(item.default ?? options[0] ?? '');
    } else {
      values[item.key] = Number(initial ?? 0);
    }

    if (item.type === 'select') {
      const buttons = [];
      for (const value of item.values || []) {
        const node = button(String(value), () => {
          values[item.key] = value;
          for (const other of buttons) {
            other.style.border = other === node ? '2px solid #8ab4f8' : '1px solid #2a303c';
          }
        });
        node.style.border = String(initial) === String(value) ? '2px solid #8ab4f8' : '1px solid #2a303c';
        buttons.push(node);
      }
      return field(item.label, row({ gap: 6 }, ...buttons));
    }

    const seed = String(values[item.key]);
    return field(item.label, input(seed, (next) => { values[item.key] = Number(next) || 0; }, { type: 'number' }));
  });

  const box = document.createElement('div');
  box.id = 'seedbox';
  box.style.position = 'fixed';
  box.style.inset = '0';
  box.style.zIndex = '50';

  // 生成方式：在「噪声野外」和「元胞地牢」之间切
  const choices = (worlds || []).filter((item) => item.startMenu);
  const switchRow = choices.length > 1
    ? [field('生成方式', row({ gap: 6 },
        ...choices.map((item) => {
          const node = button(item.name || item.id, () => {
            openStartDialog(item, values);
          });
          node.style.border = item.id === world.id ? '2px solid #8ab4f8' : '1px solid #2a303c';
          return node;
        }),
      ))]
    : [];

  const body = col({ gap: 12 },
    ...switchRow,
    ...controls,
    row({ gap: 8, justify: 'end' },
      button('取消', () => box.remove()),
      button('开始', () => {
        localStorage.setItem('nw.seed', String(values.seed ?? 0));
        for (const [key, value] of Object.entries(values)) {
          if (key !== 'seed') localStorage.setItem('nw.' + key, String(value));
        }
        const options = { ...values };
        delete options.seed;
        const params = new URLSearchParams({
          world: world.id,
          seed: String(values.seed ?? 0),
          options: JSON.stringify(options),
          fresh: '1', // 新开一局：游戏页不要接管旧会话
        });
        location.href = '/game?' + params.toString();
      }),
    ),
  );

  mount(box, modal(body, { title: (world.name || world.id) + ' · 开始' }));
  document.body.appendChild(box);
}

async function showGraph(id) {
  inspecting = id;
  const panel = document.getElementById('graphpanel');
  const tree = document.getElementById('tree');
  document.getElementById('graphtitle').textContent = '结构 · ' + id;
  panel.hidden = false;
  tree.textContent = '读取中…';

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
  const chosen = worlds.find((item) => item.id === activeWorld);
  if (chosen !== undefined && chosen.root === false) {
    document.getElementById('meta').textContent = '「' + activeWorld + '」是依赖包，不能单独开始；请选一个可玩的包。';
    return;
  }

  if (!activeWorld) {
    document.getElementById('meta').textContent = '还没有选择世界，先去「世界包」里选一个。';
    show('packs');
    return;
  }
  const world = worlds.find((item) => item.id === activeWorld) || { id: activeWorld, name: activeWorld };
  openStartDialog(world);
});

on('m-recent', async () => {
  show('recent');
  await renderRecent();
});




on('m-settings', () => { show('settings'); renderSettings(); });

on('m-packs', () => { show('packs'); renderWorlds(); });
document.getElementById('packs-back').addEventListener('click', () => show(null));
document.getElementById('recent-back').addEventListener('click', () => show(null));
on('m-quit', () => show('quit'));
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

/** 最近的世界：一个世界一行（名字 / 种子 + 尺寸 / 时间），可继续或删除。 */
async function renderRecent() {
  const list = document.getElementById('recent-list');
  if (list === null) return;

  list.textContent = '读取中…';
  const result = await api('/api/saves');
  const items = (result && result.saves) || [];
  if (items.length === 0) {
    list.textContent = '还没有世界。开始游戏会自动建一个。';
    return;
  }

  list.textContent = '';
  for (const world of items) {
    const line = document.createElement('div');
    line.className = 'world';
    line.style.display = 'flex';
    line.style.alignItems = 'center';
    line.style.gap = '8px';

    const info = document.createElement('div');
    info.style.flex = '1 1 auto';
    const size = world.options && world.options.width ? world.options.width + '×' + world.options.height : '默认';
    const when = new Date(world.latestAt || world.updatedAt || world.createdAt || Date.now()).toLocaleString();
    const saves = world.saves > 0 ? '  ·  ' + world.saves + ' 份进度' : '  ·  新世界';
    info.textContent = (world.name || world.id) + '  ·  ' + world.pack + '  ·  种子 ' + world.seed + '  ·  ' + size + saves + '  ·  ' + when;

    const open = document.createElement('button');
    open.textContent = '继续';
    open.addEventListener('click', () => {
      location.href = '/game?instance=' + encodeURIComponent(world.id);
    });

    const rename = document.createElement('button');
    rename.textContent = '改名';
    rename.addEventListener('click', async () => {
      const next = prompt('新的名字', world.name || world.id);
      if (next === null || next.trim().length === 0) return;
      await api('/api/world/rename', { id: world.id, name: next.trim() });
      renderRecent();
    });

    const del = document.createElement('button');
    del.textContent = '删除';
    del.addEventListener('click', async () => {
      if (!confirm('删除这个世界？（存档不会跟着删）')) return;
      await api('/api/world/delete', { id: world.id });
      renderRecent();
    });

    line.appendChild(info);
    line.appendChild(open);
    line.appendChild(rename);
    line.appendChild(del);
    list.appendChild(line);
  }
}
document.getElementById('quit-back').addEventListener('click', () => show(null));
document.getElementById('graphclose').addEventListener('click', () => { document.getElementById('graphpanel').hidden = true; });

document.getElementById('quit-back').textContent = '← 返回';

api('/api/worlds').then((state) => {
  worlds = state.worlds || [];
  if (!activeWorld && worlds.length > 0) {
    const usable = worlds.find((world) => world.ok && world.root);
    if (usable) activeWorld = usable.id;
  }
  renderWorlds();
  document.getElementById('meta').textContent = '选择一个世界开始';
});
