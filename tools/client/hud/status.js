// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 左下区域：状态（血量条 + 计数 + 可否行动）。
 *
 * 区域 = 常驻、只读 state、自己算自己的显示。
 */

import { bar, col, text } from '/web/game/systems/ui/spec.js';
import { mount } from '/web/game/systems/ui/dom.js';

/** 蓄力进度：没有挂起就不画。 */
function chargeRow(pending) {
  if (!pending || pending.remaining <= 0) return null;

  const total = Math.max(1, pending.total || 1);
  const done = Math.min(total, Math.max(0, total - pending.remaining));

  return {
    node: col({ gap: 2 },
      text('蓄力 ' + done + '/' + total, { policy: 'fixed' }),
      bar(done, total, { height: 8, color: '#8ab4f8' }),
    ),
  };
}

export function renderStatus(state) {
  const box = document.getElementById('status');
  if (box === null) return;

  const ready = state.hud.readyAt > state.tick
    ? '恢复中 还要 ' + (state.hud.readyAt - state.tick) + ' 回合'
    : '可以行动';

  const charge = chargeRow(state.pending);

  mount(box, col({ gap: 6 },
    bar(state.hud.hp, state.hud.hpMax, {
      label: 'HP',
      showValue: true,
      height: 16,
      color: state.hud.hp * 3 < state.hud.hpMax ? '#c96a5a' : '#4fd658',
    }),
    text('背包 ' + state.hud.inventory.length + ' · tick ' + state.tick, { policy: 'fixed' }),
    text(ready, { policy: 'fixed' }),
    ...(charge === null ? [] : [charge.node]),
  ));
}
