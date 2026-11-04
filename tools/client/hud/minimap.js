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

/** 小地图最大边长（CSS 像素）。 */
const MAX_SIDE = 180;

/** 按地图尺寸选格子大小：大地图自动缩小，最小 1px。 */
function cellFor(space) {
  const longest = Math.max(space.width, space.height);
  return Math.max(1, Math.min(4, Math.floor(MAX_SIDE / longest)));
}

export function renderMinimap(state) {
  const box = document.getElementById('minimap');
  if (box === null) return;

  const space = (state.snapshot.spaces || [])[0];
  if (space === undefined) return;

  // 小地图有上限：200×200 的地图不能画成 800px
  const cell = cellFor(space);
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
