// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * UI 描述：一组纯数据，能单测，不碰 DOM。
 *
 * 和渲染管线的分工一样：
 *   spec  声明「长什么样」（纯函数，可测）
 *   dom   把 spec 变成真实节点（执行器，几十行）
 *
 * 这样布局 bug 在 spec 层就能复现，不需要开浏览器。
 */

import { flexStyle, type SizePolicy } from "./flex.ts";

export interface UiNode {
  readonly tag: string;
  readonly style: Readonly<Record<string, string>>;
  readonly text?: string;
  readonly children: readonly UiNode[];
  readonly onClick?: () => void;
  /** input 的当前值。 */
  readonly value?: string;
  /** input 变化时回调。 */
  readonly onInput?: (value: string) => void;
  readonly className?: string;
  readonly attrs?: Readonly<Record<string, string>>;
}

export type Align = "start" | "center" | "end" | "stretch" | "baseline";
export type Justify = "start" | "center" | "end" | "between";

export interface BoxOptions {
  /** 在父容器里怎么让步。默认 fit。 */
  readonly policy?: SizePolicy;
  /** 只有 fill / grow / ratio 用得上。 */
  readonly weight?: number;
  readonly gap?: number;
  /** 数字 = 四边；数组 = [上, 右, 下, 左]。 */
  readonly padding?: number | readonly [number, number, number, number];
  readonly width?: number;
  readonly height?: number;
  readonly align?: Align;
  readonly justify?: Justify;
  readonly className?: string;
}

const ALIGN: Record<Align, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};

const JUSTIFY: Record<Justify, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
};

/** 把 BoxOptions 翻成 CSS 键值。纯函数，测试主要看这个。 */
export function boxStyle(options: BoxOptions = {}, direction: "row" | "column" = "row"): Record<string, string> {
  const style: Record<string, string> = {
    display: "flex",
    "flex-direction": direction,
    "min-width": "0",
    "min-height": "0",
    flex: flexStyle(options.policy ?? "fit", options.weight ?? 1),
  };

  if (options.gap !== undefined) style.gap = `${options.gap}px`;
  if (options.padding !== undefined) style.padding = paddingOf(options.padding);
  if (options.width !== undefined) style.width = `${options.width}px`;
  if (options.height !== undefined) style.height = `${options.height}px`;
  if (options.align !== undefined) style["align-items"] = ALIGN[options.align];
  if (options.justify !== undefined) style["justify-content"] = JUSTIFY[options.justify];

  return style;
}

function paddingOf(padding: number | readonly [number, number, number, number]): string {
  if (typeof padding === "number") return `${padding}px`;
  return padding.map((value) => `${value}px`).join(" ");
}

export function row(options: BoxOptions = {}, ...children: readonly UiNode[]): UiNode {
  return node("div", boxStyle(options, "row"), children, options);
}

export function col(options: BoxOptions = {}, ...children: readonly UiNode[]): UiNode {
  return node("div", boxStyle(options, "column"), children, options);
}

export function panel(options: BoxOptions = {}, ...children: readonly UiNode[]): UiNode {
  const style = boxStyle(options, "column");
  style.background = "rgba(16,19,26,0.85)";
  style["border-radius"] = "8px";
  style["border"] = "1px solid #2a303c";
  return node("div", style, children, options);
}

export function text(value: string, options: BoxOptions = {}): UiNode {
  const style = boxStyle(options, "row");
  style.align = "center";
  return { tag: "span", style, text: value, children: [] };
}

export function button(label: string, onClick: () => void, options: BoxOptions = {}): UiNode {
  const style = boxStyle({ policy: "fixed", ...options }, "row");
  style["align-items"] = "center";
  style["justify-content"] = "center";
  style["border-radius"] = "6px";
  style.cursor = "pointer";

  return {
    tag: "button",
    style,
    text: label,
    children: [],
    onClick,
    ...(options.className === undefined ? {} : { className: options.className }),
  };
}

function node(
  tag: string,
  style: Record<string, string>,
  children: readonly UiNode[],
  options: BoxOptions,
): UiNode {
  return {
    tag,
    style,
    children,
    ...(options.className === undefined ? {} : { className: options.className }),
  };
}

/** 全屏浮层：盖住整个视口，背景变暗，内容居中。 */
export function modal(content: UiNode, options: { readonly title?: string } = {}): UiNode {
  const backdrop: Record<string, string> = {
    position: "fixed",
    inset: "0",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: "rgba(0,0,0,0.55)",
    "pointer-events": "auto",
    "z-index": "40",
  };

  const card = panel({ padding: 20, gap: 12, width: 420 });
  const children: UiNode[] = [];
  if (options.title !== undefined) {
    children.push(text(options.title, { policy: "fixed" }));
  }
  children.push(content);

  return { tag: "div", style: backdrop, children: [{ ...card, children }] };
}

/** 进度条：value/max → 填充宽度。两端都夹住，不会溢出。 */
export function bar(value: number, max: number, options: BoxOptions = {}): UiNode {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const track = boxStyle({ ...options, policy: options.policy ?? "fixed" }, "row");
  track.background = "#22262f";
  track["border-radius"] = "6px";
  track.overflow = "hidden";

  const fill: Record<string, string> = {
    display: "block",
    width: `${Math.round(ratio * 100)}%`,
    height: "100%",
    background: "#4fd658",
  };

  return { tag: "div", style: track, children: [{ tag: "div", style: fill, children: [] }] };
}

/** 开关：显示勾选状态，点击切换。 */
export function toggle(label: string, checked: boolean, onChange: (next: boolean) => void): UiNode {
  return button((checked ? "☑ " : "☐ ") + label, () => onChange(!checked));
}

/** 输入框。只支持 text / number 两种，够用且不会被滥用。 */
export function input(
  value: string,
  onInput: (next: string) => void,
  options: BoxOptions & { readonly type?: "text" | "number" } = {},
): UiNode {
  const style = boxStyle({ policy: "fill", ...options }, "row");
  style.padding = "6px 8px";
  style.background = "#0f1116";
  style.color = "#d7dae0";
  style.border = "1px solid #333a4a";
  style["border-radius"] = "6px";

  return {
    tag: "input",
    style,
    value,
    onInput,
    children: [],
    attrs: { type: options.type ?? "text" },
  };
}

/** 一行表单：左边标签，右边控件。 */
export function field(label: string, control: UiNode, options: BoxOptions = {}): UiNode {
  return row(
    { gap: 8, align: "center", ...options },
    text(label, { policy: "fixed", width: 96 }),
    control,
  );
}
