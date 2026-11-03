// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 右下角区域：点击策略。
 *
 * 它是**区域**，不是窗口——常驻、不抢焦点、点外面就关。
 * 只认两件事：当前 state（其实用不到）和外面给的 ctx。
 */

import { button, col, grid, panel, row, text } from '/web/game/systems/ui/spec.js';
import { mount } from '/web/game/systems/ui/dom.js';

/** 四行：阵营 → 可用动作。 */
export const CLICK_ROWS = [
  { key: 'hostile', label: '敌对', actions: ['attack', 'talk', 'inspect'] },
  { key: 'neutral', label: '中立', actions: ['attack', 'talk', 'inspect'] },
  { key: 'friendly', label: '友好', actions: ['attack', 'talk', 'inspect'] },
  { key: 'item', label: '物品', actions: ['take', 'inspect'] },
];

export const ACTION_LABEL = { attack: '攻', talk: '谈', inspect: '看', take: '拾' };

const CELL = 34;

/** 3×4 空格子；第一格打开策略弱窗口。 */
export function renderQuickbar(ctx) {
  const box = document.getElementById('quick');
  if (box === null) return;

  const cells = [];

  const open = button('点击', () => togglePolicy(ctx));
  styleCell(open, true);
  cells.push(open);

  for (let i = 1; i < 12; i += 1) {
    const empty = text('', { policy: 'fixed', width: CELL, height: CELL });
    styleCell(empty, false);
    cells.push(empty);
  }

  mount(box, grid({ columns: 3, cell: CELL, gap: 0 }, ...cells));
}

function styleCell(node, accent) {
  node.style.width = CELL + 'px';
  node.style.height = CELL + 'px';
  node.style['font-size'] = '10px';
  node.style['border-radius'] = '0';
  node.style.border = accent ? '1px solid #4a6da8' : '1px solid #2a303c';
  node.style.background = accent ? '#1d2432' : 'transparent';
}

/** 打开/关闭策略弱窗口。 */
export function togglePolicy(ctx) {
  const box = document.getElementById('policy');
  if (box === null) return;
  if (!box.hidden) {
    closePolicy();
    return;
  }
  renderPolicy(ctx);
  box.hidden = false;
}

export function closePolicy() {
  const box = document.getElementById('policy');
  if (box === null) return;
  box.hidden = true;
  box.textContent = '';
}

/** 点一下换下一个动作。 */
export function cycleAction(ctx, key) {
  const entry = CLICK_ROWS.find((row) => row.key === key);
  if (entry === undefined) return;

  const current = ctx.clickPolicy[key];
  const index = entry.actions.indexOf(current);
  const next = entry.actions[(index + 1) % entry.actions.length];
  ctx.setClickPolicy(key, next);
}

/**
 * 映射窗口：每个阵营一格，点一下换下一个动作；「查看」打开转轮。
 */
function renderPolicy(ctx) {
  const box = document.getElementById('policy');
  if (box === null) return;

  const rows = CLICK_ROWS.map((entry) => {
    const current = ctx.clickPolicy[entry.key];
    const slot = button(ACTION_LABEL[current] ?? '—', () => {
      cycleAction(ctx, entry.key);
      renderPolicy(ctx);
    });
    slot.style.width = CELL + 'px';
    slot.style.height = CELL + 'px';
    slot.style['font-size'] = '12px';
    slot.style['border-radius'] = '0';
    slot.style.border = '1px solid #4a6da8';
    slot.style.background = '#1d2432';

    const view = button('查', () => renderCylinder(ctx, entry.key));
    view.style.width = '22px';
    view.style.height = CELL + 'px';
    view.style['font-size'] = '10px';
    view.style['border-radius'] = '0';

    return row({ gap: 4, align: 'center' },
      text(entry.label, { policy: 'fixed', width: 34 }),
      slot,
      view,
    );
  });

  mount(box, panel({ padding: 6, gap: 4, policy: 'fit' },
    col({ gap: 4 },
      ...rows,
    ),
  ));
}

/**
 * 转轮：动作绕一圈排，像弹匣。
 *
 * 只用 CSS 定位，没有画布——这样它跟着主题走。
 */
function renderCylinder(ctx, key) {
  const box = document.getElementById('policy');
  if (box === null) return;

  const entry = CLICK_ROWS.find((row) => row.key === key);
  if (entry === undefined) return;

  const current = ctx.clickPolicy[key];
  const size = 150;
  const radius = 52;

  const stage = document.createElement('div');
  stage.style.position = 'relative';
  stage.style.width = size + 'px';
  stage.style.height = size + 'px';
  stage.style.borderRadius = '50%';
  stage.style.border = '1px solid #2a303c';
  stage.style.background = '#0f1116';

  entry.actions.forEach((action, index) => {
    const angle = (Math.PI * 2 * index) / entry.actions.length - Math.PI / 2;
    const x = size / 2 + Math.cos(angle) * radius;
    const y = size / 2 + Math.sin(angle) * radius;

    const node = button(ACTION_LABEL[action], () => {
      ctx.setClickPolicy(key, action);
      renderPolicy(ctx);
    });
    node.style.position = 'absolute';
    node.style.left = x - 16 + 'px';
    node.style.top = y - 16 + 'px';
    node.style.width = '32px';
    node.style.height = '32px';
    node.style['border-radius'] = '50%';
    node.style['font-size'] = '11px';
    node.style.border = current === action ? '2px solid #8ab4f8' : '1px solid #2a303c';
    node.style.background = current === action ? '#26303f' : '#141821';
    stage.appendChild(node);
  });

  const back = button('返回', () => renderPolicy(ctx));
  back.style['font-size'] = '11px';

  box.textContent = '';
  box.appendChild(panel({ padding: 8, gap: 6, policy: 'fit' },
    col({ gap: 6 },
      text(entry.label + ' 的转轮', { policy: 'fixed' }),
      stage,
      row({ gap: 6, justify: 'end' }, back),
    ),
  ));
}
