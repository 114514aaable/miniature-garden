// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 设置窗口（窗口层）。
 *
 * 窗口 = 抢焦点、有 open/close 生命周期。宿主只负责：
 *   - 告诉我 config 现在是什么（getConfig / setConfig）
 *   - 给我能用的小工具（api / renderState / refreshSizes …）
 * 其余（页面结构、按键捕获、存档按钮）都在这里。
 */

import { button, col, modal, row, text } from '/web/game/systems/ui/spec.js';
import { render as renderNode } from '/web/game/systems/ui/dom.js';
import {
  clampCell,
  clampChargeMs,
  clampFrameMs,
  saveConfig,
  withBinding,
  withConfig,
} from '/web/game/systems/config/config.js';

export function createSettingsWindow(ctx) {
  const settings = {
    speed: Number(localStorage.getItem('nw.speed') || '10'),
    devlog: localStorage.getItem('nw.devlog') !== '0',
  };

  let capturingBinding = false;
  let page = 'root';

  function apply() {
    ctx.getRenderer()?.setVisualSpeed(settings.speed);
    const panel = document.getElementById('devpanel');
    if (panel) panel.style.display = settings.devlog ? '' : 'none';
    localStorage.setItem('nw.speed', String(settings.speed));
    localStorage.setItem('nw.devlog', settings.devlog ? '1' : '0');
  }

  function applyDevMode() {
    const panel = document.getElementById('devpanel');
    if (panel !== null) panel.hidden = !ctx.getConfig().devMode;
  }

  function patch(patchValue) {
    ctx.setConfig(withConfig(ctx.getConfig(), patchValue));
    saveConfig(ctx.getConfig());
  }

  async function open(nextPage = 'root') {
    page = nextPage;
    if (ctx.getFocus() === 'inventory') ctx.closeInventory();
    const box = document.getElementById('settings');
    ctx.setFocus('settings');
    box.hidden = false;
    box.textContent = '';

    const back = button('← 返回', () => open('root'));
    let body;

    if (page === 'root') {
      body = col({ gap: 8, width: 220 },
        button('配置', () => open('config')),
        button('按键', () => open('keys')),
        button('世界', () => open('world')),
        button('进度', () => open('saves')),
        button('回到启动器', async () => {
          await ctx.api('/api/leave', {});
          location.href = '/';
        }),
        button('关闭 Esc', () => close()),
      );
    } else if (page === 'config') {
      const cellRow = (label, key) => {
        const value = ctx.getConfig()[key];
        const step = (delta) => {
          patch({ [key]: clampCell(value + delta) });
          ctx.refreshSizes();
          open('config');
        };
        return row({ gap: 6, align: 'center' },
          text(label, { policy: 'fixed', width: 96 }),
          button('−', () => step(-4)),
          text(String(value), { policy: 'fixed', width: 40 }),
          button('+', () => step(4)),
        );
      };

      const msRow = (label, key, delta, clamp) => {
        const value = ctx.getConfig()[key];
        const step = (next) => {
          patch({ [key]: clamp(next) });
          open('config');
        };
        return row({ gap: 6, align: 'center' },
          text(label, { policy: 'fixed', width: 96 }),
          button('-', () => step(value - delta)),
          text(String(value) + 'ms', { policy: 'fixed', width: 64 }),
          button('+', () => step(value + delta)),
        );
      };

      body = col({ gap: 8 },
        cellRow('快捷栏格子', 'hotbarCell'),
        msRow('蓄力节奏', 'chargeTickMs', 50, clampChargeMs),
        cellRow('背包格子', 'inventoryCell'),
        msRow('帧节奏', 'frameMs', 10, clampFrameMs),
        row({ gap: 6, align: 'center' },
          text('开发者模式', { policy: 'fixed', width: 96 }),
          button(ctx.getConfig().devMode ? '开' : '关', () => {
            patch({ devMode: !ctx.getConfig().devMode });
            applyDevMode();
            open('config');
          }),
        ),
        back,
      );
    } else if (page === 'keys') {
      const rows = Object.entries(ctx.getConfig().bindings).map(([code, command]) =>
        row({ gap: 6, align: 'center' },
          text(code, { policy: 'fixed', width: 96 }),
          text(command, { policy: 'fixed' }),
          button('改', () => {
            capturingBinding = code;
            open('keys');
          }),
        ),
      );

      body = col({ gap: 6 },
        text(capturingBinding ? '按下新的键…（Esc 取消）' : '点「改」再按一个键', { policy: 'fixed' }),
        ...rows,
        back,
      );
    } else if (page === 'world') {
      const state = ctx.getLastState();
      const info = state === null ? '（未开局）'
        : '世界 ' + (state.world || '?') + ' · 种子 ' + state.seed + ' · tick ' + state.tick;
      body = col({ gap: 8 },
        text(info, { policy: 'fixed' }),
        back,
      );
    } else {
      const state = ctx.getLastState();
      const info = state === null
        ? '（未开局）'
        : (state.worldName || state.world || '?') + ' · 种子 ' + state.seed + ' · tick ' + state.tick;

      body = col({ gap: 8 },
        text('当前世界：' + info, { policy: 'fixed' }),
        button('改名', async () => {
          const state = ctx.getLastState();
          if (state === null || !state.worldId) return;
          const next = prompt('新的名字', state.worldName || '');
          if (next === null || next.trim().length === 0) return;
          await ctx.api('/api/world/rename', { id: state.worldId, name: next.trim() });
          ctx.renderState(await ctx.api('/api/state'));
          open('saves');
        }),
        row({ gap: 8 },
          button('保存进度', async () => {
            ctx.renderState(await ctx.api('/api/save', {}));
            open('saves');
          }),
          button('读取进度', async () => {
            const result = await ctx.api('/api/load', {});
            if (result && result.ok === false) {
              ctx.showError('读档失败：' + (result.error || '未知'));
              return;
            }
            ctx.renderState(result);
            open('saves');
          }),
        ),
        back,
      );
    }

    const titles = { root: '设置', config: '配置', keys: '按键', world: '世界', saves: '进度' };
    box.appendChild(renderNode(modal(body, { title: titles[page] ?? '设置' })));
  }

  function close() {
    const box = document.getElementById('settings');
    ctx.setFocus(null);
    ctx.refreshAim();
    box.hidden = true;
    box.textContent = '';
  }

  /**
   * 捕获按键：返回 true 表示这次按键被设置窗口吃掉了。
   * 宿主在 keydown 最前面调它。
   */
  function handleKeyCapture(code) {
    if (capturingBinding === false) return false;

    const oldCode = capturingBinding;
    capturingBinding = false;

    if (code !== 'Escape') {
      const command = ctx.getConfig().bindings[oldCode];
      if (command !== undefined) {
        const without = withBinding(ctx.getConfig(), oldCode, null);
        ctx.setConfig(withConfig(without, { bindings: { ...without.bindings, [code]: command } }));
        saveConfig(ctx.getConfig());
      }
    }

    open('root');
    return true;
  }

  return {
    apply,
    applyDevMode,
    open,
    close,
    handleKeyCapture,
    get page() {
      return page;
    },
  };
}
