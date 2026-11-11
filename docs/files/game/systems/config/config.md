# `game/systems/config/config.ts`

## 内容

界面配置：所有「可能想调」的东西集中在这里。
为什么单独一个模块：
- 以前尺寸散在 pages.mjs 里，改一次要翻十几处；
- 现在默认值在一处，用户改过的存 localStorage，读的时候合并；
- 以后加设置项，只改这个文件 + 设置面板的一行。
这里只放**表现层**的东西。玩法参数（时钟成本、伤害公式）在世界包里，不放这。

行数：165

## 接口

### 函数 `clampCell`

```ts
function clampCell(value: number): number
```

### 函数 `clampChargeMs`

```ts
function clampChargeMs(value: number): number
```

### 函数 `clampFrameMs`

```ts
function clampFrameMs(value: number): number
```

### 接口 `ClickAction`

```ts
interface ClickAction {
  readonly kind: "skill" | "builtin";
  readonly ref: string;
}
```

### 接口 `ClickPolicy`

```ts
interface ClickPolicy {
  readonly hostile: ClickAction;
  readonly neutral: ClickAction;
  readonly friendly: ClickAction;
  readonly item: ClickAction;
}
```

### 接口 `Config`

```ts
interface Config {
  readonly hotbarCell: number;
  readonly inventoryCell: number;
  readonly inventoryColumns: number;
  readonly inventoryRows: number;
  readonly speed: number;
  readonly chargeTickMs: number;
  readonly frameMs: number;
  readonly devMode: boolean;
  readonly clickPolicy: ClickPolicy;
  readonly bindings: Readonly<Record<string, string>>;
}
```

### 常量 `DEFAULT_CONFIG`

```ts
const DEFAULT_CONFIG: Config
```

### 函数 `loadConfig`

```ts
function loadConfig(storage: Pick<Storage, "getItem"> = localStorage): Config
```

### 函数 `normalizeAction`

```ts
function normalizeAction(value: unknown, fallback: ClickAction): ClickAction
```

### 函数 `saveConfig`

```ts
function saveConfig(config: Config, storage: Pick<Storage, "setItem"> = localStorage): void
```

### 函数 `withBinding`

```ts
function withBinding(config: Config, code: string, command: string | null): Config
```

### 函数 `withConfig`

```ts
function withConfig(config: Config, patch: Partial<Config>): Config
```

## 依赖

- [`game/systems/input/bindings.ts`](game/systems/input/bindings.md)
- [`game/systems/rules/aliases.ts`](game/systems/rules/aliases.md)

## 被引用

- [`tools/client/game.js`](tools/client/game.md)
- [`tools/client/windows/settings.js`](tools/client/windows/settings.md)
