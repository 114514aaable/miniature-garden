# `game/systems/render/draw.ts`

## 内容

绘制指令：把快照翻译成「画什么」。
这一层不碰 DOM、不碰 Canvas——它只产出命令数组。
好处是能单测：同样的快照 + 同样的样式，必须得到同样的指令。
Canvas / SVG / 终端 只是这些命令的执行器。

行数：302

## 接口

### 函数 `buildFrame`

```ts
function buildFrame(snapshot: FrameSnapshot, spec: FrameSpec): readonly DrawCommand[]
```

### 常量 `DEFAULT_STYLE`

```ts
const DEFAULT_STYLE: RenderStyle
```

### 类型 `DrawCommand`

```ts
type DrawCommand = | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly color: string } | { readonly kind: "text"; readonly x: number; readonly y: number; readonly text: string; readonly color: string; readonly size: number; } | { readonly kind: "sprite"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly image: string; readonly sx: number; readonly sy: number; readonly sw: number; readonly sh: number; /** 图片还没加载出来时画的字符。 */ readonly fallback: { readonly text: string; readonly color: string; readonly size: number }; }
```

### 接口 `EntityStyle`

```ts
interface EntityStyle {
  readonly glyph: string;
  readonly color: string;
  readonly layer?: number;
  readonly scale?: number;
  readonly corner?: boolean;
  readonly sprite?: { readonly sheet: string; readonly index: number };
}
```

### 函数 `frameNameOf`

```ts
function frameNameOf( sprite: { frame?: unknown; frames?: unknown; fps?: unknown } | undefined, nowMs: number, ): string | undefined
```

### 接口 `FrameSpec`

```ts
interface FrameSpec {
  readonly tile: number;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly camera: { readonly x: number; readonly y: number };
  readonly style: RenderStyle;
  readonly now?: number;
  readonly atlas?: Atlas;
  readonly atlases?: ReadonlyMap<string, Atlas>;
}
```

### 接口 `RenderStyle`

```ts
interface RenderStyle {
  readonly background: string;
  readonly grid: string;
  readonly terrain: Readonly<Record<number, TerrainStyle>>;
  readonly templates: Readonly<Record<string, EntityStyle>>;
  readonly fallback: EntityStyle;
}
```

### 接口 `TerrainStyle`

```ts
interface TerrainStyle {
  readonly fill: string;
  readonly glyph?: string;
  readonly sprite?: { readonly sheet: string; readonly frame: string };
}
```

## 依赖

- [`game/systems/render/atlas.ts`](game/systems/render/atlas.md)
- [`game/systems/render/project.ts`](game/systems/render/project.md)

## 被引用

- [`game/systems/render/browser.ts`](game/systems/render/browser.md)
- [`tools/serve.mjs`](tools/serve.md)
