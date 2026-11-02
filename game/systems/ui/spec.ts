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
  /** canvas 节点的绘制回调。 */
  readonly draw?: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  /** DOM 事件：drop / dragover / contextmenu … */
  readonly on?: Readonly<Record<string, (event: Event) => void>>;
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
    "z-index": "var(--z-modal, 90)",
  };

  // 宽度交给内容：窄了会挤，宽了会撑开——不再写死 420
  const base = panel({ padding: 16, gap: 10, policy: "fit" });
  const card: UiNode = {
    ...base,
    style: { ...base.style, "max-width": "92vw", "max-height": "86vh" },
  };
  const children: UiNode[] = [];
  if (options.title !== undefined) {
    children.push(text(options.title, { policy: "fixed" }));
  }
  children.push(content);

  return { tag: "div", style: backdrop, children: [{ ...card, children }] };
}

/** 进度条：value/max → 填充宽度。两端都夹住，不会溢出。 */
export interface BarOptions extends BoxOptions {
  /** 轨道高度（px）。 */
  readonly height?: number;
  /** 填充色。 */
  readonly color?: string;
  /** 左侧文字（比如「HP」）。 */
  readonly label?: string;
  /** 是否显示「14 / 20」。 */
  readonly showValue?: boolean;
}

/**
 * 条：血量、体力、蓄力……所有「有上限的当前值」都用它。
 *
 * 只画一条，不做分段、不做渐变——分段是另一层的事（以后加）。
 */
export function bar(value: number, max: number, options: BarOptions = {}): UiNode {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const height = options.height ?? 14;

  const track: Record<string, string> = {
    position: "relative",
    height: `${height}px`,
    background: "#22262f",
    "border-radius": "4px",
    overflow: "hidden",
    flex: "1 1 auto",
  };

  const fill: Record<string, string> = {
    position: "absolute",
    left: "0",
    top: "0",
    height: "100%",
    width: `${Math.round(ratio * 100)}%`,
    background: options.color ?? "#4fd658",
    transition: "width 120ms ease",
  };

  const children: UiNode[] = [{ tag: "div", style: fill, children: [] }];

  if (options.label !== undefined) {
    children.push({
      tag: "span",
      style: { position: "absolute", left: "6px", top: "50%", transform: "translateY(-50%)", color: "#0d1015", "font-size": "10px", "font-weight": "600" },
      children: [],
      text: options.label,
    });
  }

  if (options.showValue === true) {
    children.push({
      tag: "span",
      style: { position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", color: "#d7dae0", "font-size": "10px" },
      children: [],
      text: `${value} / ${max}`,
    });
  }

  return { tag: "div", style: track, children };
}

/** 画布：小地图这类「自己会画」的部件用。 */
export function canvasNode(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void,
): UiNode {
  return {
    tag: "canvas",
    style: { width: `${width}px`, height: `${height}px`, display: "block" },
    children: [],
    draw,
  };
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

/** 给节点挂事件与属性（不改原节点）。套件里唯一需要「碰 DOM 事件」的入口。 */
export function withEvents(
  node: UiNode,
  on: Readonly<Record<string, (event: Event) => void>>,
  attrs: Readonly<Record<string, string>> = {},
): UiNode {
  return { ...node, on, attrs: { ...(node.attrs ?? {}), ...attrs } };
}

/** 等宽网格：背包格子用。列数与格宽固定，空位由调用方补空节点。 */
export function grid(
  options: BoxOptions & { readonly columns: number; readonly cell?: number },
  ...children: readonly UiNode[]
): UiNode {
  const style = boxStyle({ ...options, policy: options.policy ?? "fixed" }, "row");
  style.display = "grid";
  style["grid-template-columns"] = `repeat(${options.columns}, ${options.cell ?? 72}px)`;
  if (options.gap !== undefined) style.gap = `${options.gap}px`;
  return { tag: "div", style, children };
}
