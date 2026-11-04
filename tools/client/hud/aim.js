// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 瞄准高亮：记住「鼠标在哪、当前选了什么技能」，随时可以重算。
 *
 * 为什么单独一个模块：
 *   以前这段逻辑写在 mousemove 里——鼠标不动就永远不更新，
 *   于是「切技能」「状态变了」都要靠人手动补一次请求。
 *
 * 现在只有两个状态：hover 格 + 技能 tag。
 * 任何地方想知道「现在该亮哪些格」都调 refresh()。
 */

/**
 * @param {(tag: string, x: number, y: number) => Promise<{ ok?: boolean, cells?: number[][] }>} request
 * @param {(cells: ReadonlyArray<readonly [number, number]>) => void} apply
 */
export function createAimTracker({ request, apply, fallbackTag = 'base.attack' }) {
  let hover = null;
  let tag = null;
  let pending = 0;

  return {
    /** 鼠标移到某一格（null = 离开地图）。 */
    setHover(cell) {
      hover = cell;
      this.refresh();
    },

    /** 当前选中的技能（null = 默认攻击）。 */
    setTag(next) {
      tag = next;
      this.refresh();
    },

    /**
     * 重算。鼠标没动也可以调——这是它存在的意义。
     *
     * 用序号丢弃过期响应：连续移动时，早发的请求可能后到。
     */
    refresh() {
      if (hover === null) {
        apply([]);
        return Promise.resolve();
      }

      const seq = ++pending;
      return request(tag ?? fallbackTag, hover.x, hover.y).then((result) => {
        if (seq !== pending) return; // 已经有更新的请求了
        apply(result && result.ok ? result.cells ?? [] : []);
      });
    },

    /** 收起高亮（鼠标离开）。 */
    clear() {
      hover = null;
      apply([]);
    },
  };
}
