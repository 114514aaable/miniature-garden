// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 页面共用：错误提示 + API 调用。
 *
 * 以前这段是模板里插进去的（`${ERRORS}`），拆成独立文件后必须真的存在。
 */

window.addEventListener("error", (event) => {
  const bar = document.getElementById("errbar");
  if (!bar) return;
  bar.hidden = false;
  bar.textContent = "页面出错：" + (event.message || "未知") + (event.filename ? " @" + event.lineno : "");
});

window.addEventListener("unhandledrejection", (event) => {
  const bar = document.getElementById("errbar");
  if (!bar) return;
  bar.hidden = false;
  bar.textContent = "未处理的错误：" + (event.reason && event.reason.message ? event.reason.message : event.reason);
});

export async function api(path, body) {
  const options =
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        };
  return fetch(path, options).then((response) => response.json());
}
