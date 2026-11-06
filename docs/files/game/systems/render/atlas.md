# `game/systems/render/atlas.ts`

## 内容

图集：读 TexturePacker 的 JSON hash 格式。
为什么用这个格式而不是自造：它已经是事实标准，TexturePacker / Aseprite /
各种打包脚本都能直接产出。我们只需要会读。
帧名 = 源文件路径（"Enemies/Skeleton.png"），不是自造 id。
动画靠文件名编号聚合（"Arms1.png" / "Arms2.png" → "Arms"）。

行数：122

## 接口

### 接口 `Atlas`

```ts
interface Atlas {
  readonly image: string;
  readonly frames: ReadonlyMap<string, AtlasFrame>;
  readonly animations: ReadonlyMap<string, readonly string[]>;
}
```

### 接口 `AtlasFrame`

```ts
interface AtlasFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly sourceW: number;
  readonly sourceH: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly trimmed: boolean;
}
```

### 函数 `frameOf`

```ts
function frameOf(atlas: Atlas, name: string): AtlasFrame | undefined
```

### 函数 `parseAtlas`

```ts
function parseAtlas(raw: unknown, path = "$atlas"): Atlas
```

## 依赖

（无）

## 被引用

- [`game/systems/render/browser.ts`](game/systems/render/browser.md)
- [`game/systems/render/draw.ts`](game/systems/render/draw.md)
