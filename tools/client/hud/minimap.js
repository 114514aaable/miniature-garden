// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 右上区域：小地图。
 *
 * 只读快照，不碰世界；玩家蓝、其他红。
 */

import { canvasNode } from '/web/game/systems/ui/spec.js';
import { mount } from '/web/game/systems/ui/dom.js';
import { drawMinimap, minimapSize } from '/web/game/systems/ui/minimap.js';

export function renderMinimap(state) {
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
      color: entity.handle === state.playerHandle ? '#8ab4f8' : '#c96a5a',
    }));

  mount(box, canvasNode(size.width, size.height, (context) => {
    drawMinimap(context, { space, cell, marks });
  }));
}
