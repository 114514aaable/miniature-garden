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

function renderPolicy(ctx) {
  const box = document.getElementById('policy');
  if (box === null) return;

  const rows = CLICK_ROWS.map((entry) => {
    const current = ctx.clickPolicy[entry.key];
    const cells = entry.actions.map((action) => {
      const picked = current === action;
      const node = button(ACTION_LABEL[action], () => {
        ctx.setClickPolicy(entry.key, action);
        // setClickPolicy 会重画区域；这里再把窗口按最新值重画一次
        renderPolicy(ctx);
      });
      styleCell(node, picked);
      return node;
    });

    return row({ gap: 2, align: 'center' },
      text(entry.label, { policy: 'fixed', width: 30 }),
      ...cells,
    );
  });

  mount(box, panel({ padding: 8, gap: 4, policy: 'fit' },
    col({ gap: 4 },
      ...rows,
      row({ gap: 6, justify: 'end' }, button('关', () => closePolicy())),
    ),
  ));
}
