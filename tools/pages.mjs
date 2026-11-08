// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 两个页面：启动器和游戏。
 *
 * 为什么拆开：它们的状态完全无关——启动器只管「列出世界、看结构」，
 * 游戏只管「画一局」。挤在一个页面里，任何一边出错都会白屏，
 * 而且互相污染（切回启动器要清理游戏状态、游戏要忽略启动器面板）。
 *
 * 两个页面共享同一套 API，但谁也不 import 谁。
 */

const CSS = `
  :root { color-scheme: dark; }
  body { margin: 0; font: 14px/1.5 ui-monospace, Consolas, monospace;
         background: #14161a; color: #d7dae0; display: flex; justify-content: center; }
  main { padding: 24px; max-width: 900px; width: 100%; }
  h1 { font-size: 18px; font-weight: 600; color: #8ab4f8; margin: 0 0 4px; }
  .meta { color: #8b929e; margin-bottom: 16px; }
  button { padding: 6px 12px; background: #232733; color: #d7dae0;
           border: 1px solid #333a4a; border-radius: 6px; cursor: pointer; }
  button:hover { background: #2c3242; }
  .world { display: flex; justify-content: space-between; align-items: center; gap: 16px;
           padding: 12px 14px; margin-bottom: 8px; background: #1b1f27;
           border: 1px solid #2a303c; border-radius: 8px; }
  .world .name { font-weight: 600; }
  .world .packs { color: #7f8794; font-size: 12px; }
  .world .error { color: #e06c75; font-size: 12px; }
  .world.bad button { opacity: 0.4; cursor: not-allowed; }
  .world.dep { opacity: 0.55; }
  .stage { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  #map { display: block; background: #0d0f13; border-radius: 8px;
         image-rendering: pixelated; width: 480px; height: 360px; cursor: crosshair; }
  #hud { margin-top: 10px; color: #9aa3b2; }
  #hud b { color: #d7dae0; }
  .pad { display: grid; grid-template-columns: repeat(3, 56px); gap: 8px; }
  .pad button { height: 56px; font-size: 18px; }
  .pad .empty { visibility: hidden; }
  .skills { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .skills .hint { color: #7f8794; font-size: 12px; align-self: center; }
  #message { margin-top: 16px; min-height: 24px; color: #f0c674; }
  #devpanel { margin-top: 12px; color: #7f8794; font-size: 12px; }
  #devpanel summary { cursor: pointer; }
  #devlog, #debug { margin: 8px 0 0; padding: 8px; max-height: 200px; overflow: auto; color: #8b929e;
                    background: #0f1116; border: 1px solid #232733; border-radius: 6px; white-space: pre; }
  #graphpanel[hidden] { display: none; }
  #graphpanel { position: fixed; inset: 40px 60px; z-index: var(--z-global-mask); display: flex; flex-direction: column;
                pointer-events: auto;
                background: #10131a; border: 1px solid #2a303c; border-radius: 10px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6); padding: 12px 16px; }
  .graphbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .graphbar span { color: #8ab4f8; font-weight: 600; }
  #tree { margin: 0; flex: 1 1 auto; min-height: 0; overflow: auto; color: #9aa3b2; font-size: 12px;
          overflow-x: auto;
          padding-right: 6px; }
  #tree::-webkit-scrollbar { width: 10px; }
  #tree::-webkit-scrollbar-thumb { background: #2a303c; border-radius: 5px; }
  #tree::-webkit-scrollbar-track { background: #0f1116; }
  :root { --z-region: 10; --z-effects: 30; --z-region-mask: 50; --z-modal: 90; --z-global-mask: 100; }
  #errbar { position: sticky; top: 0; z-index: 95; margin-bottom: 12px; padding: 8px 12px;
            background: #3a1d22; color: #ff9aa2; border: 1px solid #5c2a32; border-radius: 6px;
            font-size: 12px; white-space: pre-wrap; }
  .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  a { color: #8ab4f8; }
`;

/** 每次进程启动换一次，用来给页面脚本加版本号（防缓存）。 */
const BUILD_ID = Date.now().toString(36);

const ERRORS = `
window.addEventListener('error', (event) => {
  const bar = document.getElementById('errbar');
  if (!bar) return;
  bar.hidden = false;
  bar.textContent = '页面出错：' + (event.message || '未知') + (event.filename ? ' @' + event.lineno : '');
});
window.addEventListener('unhandledrejection', (event) => {
  const bar = document.getElementById('errbar');
  if (!bar) return;
  bar.hidden = false;
  bar.textContent = '未处理的错误：' + (event.reason && event.reason.message ? event.reason.message : event.reason);
});
async function api(path, body) {
  const options = body === undefined ? {} : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
  return fetch(path, options).then((response) => response.json());
}
`;

/** 启动器：列世界、看结构、跳转到 /game。 */
/** 启动器：世界列表 + 结构树（组可整体开关）。 */
/** 启动器：主菜单 → 开始 / 读档 / 设置 / 世界包 / 退出。 */
export const LAUNCHER_PAGE = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>{{app.title}}</title>
<style>${CSS}</style>
<style>
  #graph { white-space: normal; }
  .tree details { margin-left: 14px; }
  .tree summary { cursor: pointer; color: #9aa3b2; padding: 2px 0; }
  .tree summary b { color: #d7dae0; }
  .tree .leaf { margin-left: 22px; padding: 2px 0; color: #8b929e; display: flex; gap: 6px;
                align-items: baseline; white-space: nowrap; }
  .tree .leaf .id { color: #5f6b7a; font-size: 11px; }
  .tree .leaf .desc { color: #6f7a89; font-size: 11px; }
  .tree label.group { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
  /* 自绘勾选框：不依赖系统主题，暗色背景下一定看得见 */
  .tree input[type=checkbox] { appearance: none; -webkit-appearance: none; position: relative;
                               width: 14px; height: 14px; border: 1px solid #4a6da8; border-radius: 3px;
                               background: #0f1116; cursor: pointer; flex: 0 0 auto; margin: 0; }
  .tree input[type=checkbox]:checked { background: #4a6da8; }
  .tree input[type=checkbox]:checked::after { content: ""; position: absolute; left: 4px; top: 1px;
                                              width: 4px; height: 8px; border: solid #fff;
                                              border-width: 0 2px 2px 0; transform: rotate(45deg); }
  .tree input[type=checkbox]:indeterminate { background: #4a6da8; }
  .tree input[type=checkbox]:indeterminate::after { content: ""; position: absolute; left: 3px; top: 6px;
                                                    width: 8px; height: 2px; background: #fff; }
  .menu { display: flex; flex-direction: column; gap: 10px; width: min(320px, 100%); margin-top: 20px; }
  .menu button { padding: 12px 16px; text-align: left; font-size: 15px; }
  .panel { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center;
           background: rgba(0,0,0,0.55); }
  .panel[hidden] { display: none; }
  .panel.plain { background: none; }
  .card { background: #10131a; border: 1px solid #2a303c; border-radius: 10px;
          padding: 20px; min-width: min(380px, 90vw); max-width: min(560px, 92vw);
          max-height: 80vh; overflow: auto; }
  .panel h2 { font-size: 15px; color: #8ab4f8; margin: 0 0 10px; }
  .world.picked { border-color: #4a6da8; background: #1d2432; }
</style>
<main>
  <div id="errbar" hidden></div>
  <h1>{{app.title}}</h1>
  <div class="meta" id="meta">{{launcher.pick}}</div>

  <div class="menu" id="menu">
    <button id="m-start">{{menu.start}}</button>
    <button id="m-recent">存档</button>
    <button id="m-settings">{{menu.settings}}</button>
    <button id="m-packs">{{menu.packs}}</button>
    <button id="m-quit">{{menu.quit}}</button>
  </div>

  <div class="panel" id="packs" hidden><div class="card">
    <h2>{{menu.packs}}</h2>
    <div id="worlds"></div>
    <div id="errors"></div>
    <div style="margin-top:10px"><button id="packs-back">{{menu.back}}</button></div>
  </div></div>

  <div class="panel" id="recent" hidden><div class="card">
    <h2>存档</h2>
    <div id="recent-list" style="max-height:320px;overflow:auto"></div>
    <div style="margin-top:10px"><button id="recent-back">{{menu.back}}</button></div>
  </div></div>

  <div class="panel plain" id="settings" hidden></div>

  <div class="panel" id="quit" hidden><div class="card">
    <h2>{{menu.quit}}</h2>
    <div style="color:#9aa3b2">{{menu.quit_note}}</div>
    <div style="margin-top:10px"><button id="quit-back">{{menu.back}}</button></div>
  </div></div>
</main>

<div id="graphpanel" hidden>
  <div class="graphbar">
    <span id="graphtitle">{{launcher.structure_title}}</span>
    <button id="graphclose">{{launcher.close}}</button>
  </div>
  <div class="tree" id="tree"></div>
  <div style="margin-top:10px; display:flex; gap:10px; align-items:center">
    <span class="meta" id="offcount" style="margin:0"></span>
  </div>
</div>

<script type="module" src="/client/launcher.js?v=${BUILD_ID}"></script>
</html>`;

/** 游戏：全屏地图 + HUD 叠加层。世界由 ?world= 指定。 */
export const GAME_PAGE = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>新世界</title>
<style>${CSS}</style>
<style>
  body { overflow: hidden; }
  #stage { display: flex; width: 100vw; height: 100vh; }
  #leftrail { width: 200px; flex: 0 0 auto; padding: 8px; box-sizing: border-box;
              background: #0d1015; border-right: 1px solid #1d222b;
              overflow-y: auto; transition: width 120ms ease; }
  #leftrail.collapsed { width: 32px; padding: 6px 2px; }
  #stage-map { position: relative; flex: 1 1 auto; min-width: 0; }
  #map { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 0; }
  #hud { position: absolute; inset: 0; pointer-events: none; }
  #hud > * { pointer-events: auto; }
  #topbar { position: absolute; top: 10px; left: 10px; right: 10px; display: flex; gap: 8px;
           align-items: center; pointer-events: none; }
  #topbar > * { pointer-events: auto; }
  #topbar a { margin-right: auto; }
            padding: 4px 8px; background: rgba(16,19,26,0.75); border-radius: 8px; }
  /* 左侧立绘：现在只有占位，以后换成图 */
  #portrait { position: relative; width: 100%; box-sizing: border-box;
              background: rgba(16,19,26,0.8); border: 1px solid #2a303c; border-radius: 10px;
              padding: 8px; text-align: center; }
  #portrait-toggle { position: absolute; right: -12px; top: 50%; transform: translateY(-50%);
                      width: 22px; height: 44px; padding: 0; border-radius: 6px;
                      background: #1b1f27; border: 1px solid #333a4a; color: #9aa3b2;
                      cursor: pointer; z-index: 2; }
  #portrait.collapsed { width: 20px; padding: 0; }
  #portrait.collapsed #portrait-toggle { right: auto; left: 0; width: 20px; height: 56px; border-radius: 4px; }
  #portrait.collapsed #portrait-art,
  #portrait.collapsed #nameplate { display: none; }
  #portrait { transition: width 120ms ease; }
  #portrait-art { height: 190px; max-height: 30vh; display: flex; align-items: center; justify-content: center;
                  background: #0f1116; border-radius: 6px; color: #8ab4f8; font-size: 48px; }
  #nameplate { margin-top: 6px; color: #d7dae0; font-weight: 600; }

  #status { position: relative; margin-top: 8px; width: 100%; box-sizing: border-box;
            padding: 8px 10px; background: rgba(16,19,26,0.8); border: 1px solid #2a303c;
            border-radius: 8px; font-size: 13px; line-height: 1.6; }
  #equip { margin-top: 8px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
  #equip .slot { height: 44px; border: 1px solid #2a303c; background: #12151c; }
  #skills { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
            display: flex; gap: 6px; margin: 0; }
  #skills button { min-width: 64px; height: 52px; }
  #skills .hint { display: none; }
  #message { position: absolute; bottom: 78px; left: 50%; transform: translateX(-50%);
             margin: 0; padding: 4px 10px; background: rgba(16,19,26,0.7); border-radius: 6px;
             white-space: nowrap; }
  #logbox { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: min(560px, 60vw);
            max-height: 92px; overflow: hidden; padding: 6px 12px; background: rgba(16,19,26,0.72);
            border-radius: 8px; color: #9aa3b2; font-size: 12px; white-space: pre; }
  #tooltip { position: fixed; z-index: 30; pointer-events: none; max-width: 320px;
             padding: 6px 10px; background: rgba(10,12,16,0.92); border: 1px solid #2a303c;
             border-radius: 6px; color: #c7cdd6; font-size: 12px; white-space: pre-wrap; }
  #quick { position: absolute; right: 10px; bottom: 10px; z-index: var(--z-region);
           pointer-events: auto; }
  /* 弱窗口：贴着右下角，不遮全屏，不抢焦点 */
  /* 弱窗口：小卡片，不遮背景，能点 */
  #policy { position: absolute; right: 10px; bottom: 146px; z-index: var(--z-region-mask);
            pointer-events: auto; width: max-content;
            background: #10131a; border: 1px solid #2a303c; border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  #policy[hidden] { display: none; }
  #dialog { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%);
            width: min(560px, 86vw); z-index: var(--z-modal); }
  #minimap { position: absolute; right: 10px; top: 54px; padding: 4px; z-index: var(--z-region);
             background: rgba(16,19,26,0.8); border: 1px solid #2a303c; border-radius: 6px; }
  #devpanel { position: absolute; top: 10px; right: 10px; max-width: min(460px, 92vw); }

  /* 窄屏：HUD 收起来，别互相压 */
  @media (max-width: 900px) {
    #logbox { display: none; }
    #portrait { width: 120px; }
    #portrait-art { height: 130px; font-size: 34px; }
    #status { width: 120px; top: 250px; font-size: 12px; }
    #message { bottom: 74px; max-width: 92vw; overflow: hidden; text-overflow: ellipsis; }
  }
  @media (max-width: 640px) {
    #status { font-size: 12px; padding: 4px 6px; }
    #topbar .meta { display: none; }
    #skills { gap: 4px; bottom: 8px; }
    #skills button { min-width: 52px; height: 46px; font-size: 12px; padding: 0 6px; }
    #devpanel:not([open]) { display: none; }
  }
  #devpanel[open] { background: rgba(16,19,26,0.92); padding: 8px 10px; border-radius: 8px; }
</style>

<div id="stage">
  <aside id="leftrail">
    <div id="portrait">
      <button id="portrait-toggle" title="收起/展开">‹</button>
      <div id="portrait-art"><span id="portrait-glyph">@</span></div>
      <div id="nameplate">你</div>
    </div>
    <div id="status"></div>
    <div id="equip" title="装备（以后接数据）"></div>
  </aside>

  <div id="stage-map">
<canvas id="map"></canvas>

<div id="hud">
  <div id="errbar" hidden></div>

  <div id="topbar">
    <a href="/">{{game.back}}</a>
    <button id="settingsbtn">{{menu.settings}}</button>
  </div>

  <div id="minimap"></div>
  <div id="skills"></div>
  <div id="quick"></div>
  <div id="message"></div>
  <div id="logbox"></div>

  <div id="settings" hidden></div>
  <div id="tooltip" hidden></div>
  <div id="death" hidden></div>
  <div id="dialog" hidden></div>
  <div id="policy" hidden></div>
  <div id="inventory" hidden></div>

  <details id="devpanel">
    <summary>{{game.devlog}}</summary>
    <pre id="debug"></pre>
    <pre id="devlog"></pre>
  </details>
</div>
  </div>
</div>

<script>
// 模块脚本加载失败时，这段（经典脚本）还能报错。
window.addEventListener('error', function (event) {
  var bar = document.getElementById('errbar');
  if (!bar) return;
  bar.hidden = false;
  bar.textContent = '页面出错：' + (event.message || '脚本加载失败') +
    (event.filename ? '  @' + event.filename + ':' + event.lineno : '');
});
</script>

<script type="module" src="/client/game.js?v=${BUILD_ID}"></script>
</html>`;

/** 结构面板用的元素在启动器页里，这里只导出页面本身。 */
export const PAGES = { LAUNCHER_PAGE, GAME_PAGE };
