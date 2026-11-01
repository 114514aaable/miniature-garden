// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 把 spec 变成真实 DOM。这一层不判断任何布局，只做搬运。
 *
 * 唯一允许「测量/摆放」的地方在 CanvasSlot（画布要跟着容器变大小），
 * 见各处的注释。
 */

import { type UiNode } from "./spec.ts";

/** 建一个节点（不挂到文档上）。 */
export function render(node: UiNode): HTMLElement {
  const element = document.createElement(node.tag);

  for (const [key, value] of Object.entries(node.style)) {
    element.style.setProperty(key, value);
  }
  if (node.className !== undefined) {
    element.className = node.className;
  }
  if (node.attrs !== undefined) {
    for (const [key, value] of Object.entries(node.attrs)) {
      element.setAttribute(key, value);
    }
  }
  if (node.text !== undefined) {
    element.textContent = node.text;
  }
  if (node.onClick !== undefined) {
    element.addEventListener("click", node.onClick);
  }
  for (const child of node.children) {
    element.appendChild(render(child));
  }

  return element;
}

/** 用新节点替换容器内容。 */
export function mount(container: HTMLElement, node: UiNode): void {
  container.textContent = "";
  container.appendChild(render(node));
}
