// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 背包窗口。
 *
 * 结构：左边详情、中间格子、下边分页、再下边是快捷栏映射（拖进去绑定）。
 * 窗口只认 ctx：数据从外面拿，绑定/落盘也交回宿主。
 */

import { button, col, grid, modal, row, text, withEvents } from '/web/game/systems/ui/spec.js';
import { render as renderNode } from '/web/game/systems/ui/dom.js';

const PER_PAGE = 40;

export function createInventoryWindow(ctx) {
  let items = [];
  let skills = [];
  let selected = null;
  let page = 0;

  /** 技能也当成「物品」：统一成 {kind, ref, name, desc}。 */
  function allEntries() {
    const list = skills
      .filter((skill) => skill.tag !== 'core.move')
      .map((skill) => ({ kind: 'skill', ref: skill.tag, name: skill.name, desc: '技能' }));
    const loot = items.map((item) => ({
      kind: 'item', ref: item.handle, name: item.name, desc: item.description,
    }));
    return [...list, ...loot];
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

  function entryCell(entry, size) {
    if (entry === undefined) {
      const empty = text('', { policy: 'fixed', width: size, height: size });
      cellStyle(empty, size, false);
      return empty;
    }

    const picked = selected !== null && selected.kind === entry.kind && selected.ref === entry.ref;
    const node = button(entry.name, () => { selected = entry; draw(); });
    cellStyle(node, size, picked);
    return withEvents(node, {
      dragstart: (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify({ kind: entry.kind, ref: entry.ref }));
      },
    }, { draggable: 'true' });
  }

  function hotbarMiniCell(index, size, columns) {
    const slots = ctx.getHotbarSlots();
    const entry = slots[index];
    const node = button(entry === null ? String(index + 1) : ctx.hotbarLabel(entry), () => {});
    cellStyle(node, size, false);
    node.style['font-size'] = '8px';
    void columns;

    return withEvents(node, {
      dragover: (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; },
      drop: (event) => {
        event.preventDefault();
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        ctx.setHotbarSlot(index, { kind: data.kind, ref: data.ref });
        draw();
      },
      contextmenu: (event) => {
        event.preventDefault();
        ctx.setHotbarSlot(index, null);
        draw();
      },
    });
  }

  function draw() {
    const config = ctx.getConfig();
    const box = document.getElementById('inventory');
    const entries = allEntries();
    const pages = Math.max(1, Math.ceil(entries.length / PER_PAGE));
    page = Math.min(page, pages - 1);

    const start = page * PER_PAGE;
    const cells = [];
    for (let i = 0; i < PER_PAGE; i += 1) {
      cells.push(entryCell(entries[start + i], config.inventoryCell));
    }

    const detail = selected === null
      ? col({ gap: 4 }, text('没有选中格子', { policy: 'fixed' }))
      : col({ gap: 4 },
          text(selected.name, { policy: 'fixed' }),
          text(selected.desc, { policy: 'fixed' }),
        );

    const pager = row({ gap: 6, align: 'center' },
      button('‹', () => { page = Math.max(0, page - 1); draw(); }),
      text('第 ' + (page + 1) + ' / ' + pages + ' 页', { policy: 'fixed' }),
      button('›', () => { page = Math.min(pages - 1, page + 1); draw(); }),
    );

    const slots = ctx.getHotbarSlots();
    const miniHotbar = grid({ columns: ctx.hotbarColumns(), cell: config.hotbarCell, gap: 0 },
      ...slots.map((_, index) => hotbarMiniCell(index, config.hotbarCell, ctx.hotbarColumns())),
    );

    const body = row({ gap: 12, align: 'flex-start' },
      col({ gap: 6, width: 110 }, detail),
      col({ gap: 8 },
        text('背包（拖到下面的快捷栏）', { policy: 'fixed' }),
        grid({ columns: config.inventoryColumns, cell: config.inventoryCell, gap: 0 }, ...cells),
        pager,
        text('快捷栏（右键清空）', { policy: 'fixed' }),
        miniHotbar,
      ),
    );

    box.textContent = '';
    box.appendChild(renderNode(modal(col({ gap: 10 },
      body,
      row({ gap: 8, justify: 'end' }, button('关闭 I', () => close())),
    ), { title: '背包' })));
  }

  async function open() {
    if (ctx.getFocus() === 'settings') ctx.closeSettings();
    const state = ctx.getLastState();
    if (state !== null) skills = state.skills.filter((skill) => skill.tag !== 'core.move');

    const box = document.getElementById('inventory');
    ctx.setFocus('inventory');
    box.hidden = false;

    const data = await ctx.api('/api/inventory');
    items = (data && data.items) || [];
    selected = null;
    page = 0;
    draw();
  }

  function close() {
    const box = document.getElementById('inventory');
    ctx.setFocus(null);
    ctx.refreshAim();
    box.hidden = true;
    box.textContent = '';
  }

  function toggle() {
    const box = document.getElementById('inventory');
    if (box.hidden) open(); else close();
  }

  return { open, close, toggle, redraw: draw };
}
