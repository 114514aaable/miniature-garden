# `game/systems/ui/spec.ts`

## 内容

UI 描述：一组纯数据，能单测，不碰 DOM。
和渲染管线的分工一样：
spec  声明「长什么样」（纯函数，可测）
dom   把 spec 变成真实节点（执行器，几十行）
这样布局 bug 在 spec 层就能复现，不需要开浏览器。

行数：307

## 接口

### 类型 `Align`

```ts
type Align = "start" | "center" | "end" | "stretch" | "baseline"
```

### 函数 `bar`

```ts
function bar(value: number, max: number, options: BarOptions = {}): UiNode
```

### 接口 `BoxOptions`

```ts
interface BoxOptions {
  readonly policy?: SizePolicy;
  readonly weight?: number;
  readonly gap?: number;
  readonly padding?: number | readonly [number, number, number, number];
  readonly width?: number;
  readonly height?: number;
  readonly align?: Align;
  readonly justify?: Justify;
  readonly className?: string;
}
```

### 函数 `boxStyle`

```ts
function boxStyle(options: BoxOptions = {}, direction: "row" | "column" = "row"): Record<string, string>
```

### 函数 `button`

```ts
function button(label: string, onClick: () => void, options: BoxOptions =
```

### 函数 `canvasNode`

```ts
function canvasNode( width: number, height: number, draw: (context: CanvasRenderingContext2D, width: number, height: number) => void, ): UiNode
```

### 函数 `col`

```ts
function col(options: BoxOptions = {}, ...children: readonly UiNode[]): UiNode
```

### 函数 `field`

```ts
function field(label: string, control: UiNode, options: BoxOptions = {}): UiNode
```

### 函数 `grid`

```ts
function grid( options: BoxOptions & { readonly columns: number; readonly cell?: number }, ...children: readonly UiNode[] ): UiNode
```

### 函数 `input`

```ts
function input( value: string, onInput: (next: string) => void, options: BoxOptions &
```

### 类型 `Justify`

```ts
type Justify = "start" | "center" | "end" | "between"
```

### 函数 `modal`

```ts
function modal(content: UiNode, options: { readonly title?: string } = {}): UiNode
```

### 函数 `panel`

```ts
function panel(options: BoxOptions = {}, ...children: readonly UiNode[]): UiNode
```

### 函数 `row`

```ts
function row(options: BoxOptions = {}, ...children: readonly UiNode[]): UiNode
```

### 函数 `text`

```ts
function text(value: string, options: BoxOptions = {}): UiNode
```

### 函数 `toggle`

```ts
function toggle(label: string, checked: boolean, onChange: (next: boolean) => void): UiNode
```

### 接口 `UiNode`

```ts
interface UiNode {
  readonly tag: string;
  readonly style: Readonly<Record<string, string>>;
  readonly text?: string;
  readonly children: readonly UiNode[];
  readonly onClick?: () => void;
  readonly value?: string;
  readonly onInput?: (value: string) => void;
  readonly className?: string;
  readonly attrs?: Readonly<Record<string, string>>;
  readonly draw?: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  readonly on?: Readonly<Record<string, (event: Event) => void>>;
}
```

### 函数 `withEvents`

```ts
function withEvents( node: UiNode, on: Readonly<Record<string, (event: Event) => void>>, attrs: Readonly<Record<string, string>> =
```

## 依赖

- [`game/systems/ui/flex.ts`](game/systems/ui/flex.md)

## 被引用

- [`game/systems/ui/dom.ts`](game/systems/ui/dom.md)
- [`tools/client/game.js`](tools/client/game.md)
- [`tools/client/hud/minimap.js`](tools/client/hud/minimap.md)
- [`tools/client/hud/quickbar.js`](tools/client/hud/quickbar.md)
- [`tools/client/hud/status.js`](tools/client/hud/status.md)
- [`tools/client/launcher.js`](tools/client/launcher.md)
- [`tools/client/windows/inventory.js`](tools/client/windows/inventory.md)
- [`tools/client/windows/settings.js`](tools/client/windows/settings.md)
