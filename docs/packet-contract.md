# Event 管线契约 v0.1（草案）

> 状态：定稿前的最后一版草案。写完就按它实现。
> 目标：**第三方只看这份文档，就能独立实现一个兼容的解析器。**

## 0. 一句话

世界的行为 = 一棵**调用树**。每个节点是一个带标签的信封（Envelope），标签决定调用哪个函数，
函数是纯的，只返回结果；结果里的效果沿树汇聚，最后由 store 落地。

## 1. 两段模型

| 阶段 | 发生什么 | 能不能省 |
|---|---|---|
| **加载期**（一次） | 解析标签、校验签名、建立调用图、算哈希 | 不能 |
| **运行期**（每 tick） | 直接调用已链接的函数、收集结果、提交给 store | 跳过校验 |

运行期不再解析、不再校验——这是合法的，因为**链接之后图不可变**。
改了图就必须重新链接，哈希会变。

## 2. 命名

| 名字 | 指什么 | 备注 |
|---|---|---|
| **Event 管线** | 解析 + 求值 + 提交这一整套 | 本文档的主角 |
| **Envelope** | 一次调用的信封（作者写的对象） | 见 §3 |
| **Frame** | 信封 + 运行期上下文（时间、来源、深度） | 见 §3 |
| **LogEntry** | 时间线里落地的一条记录 | 原名 `Event`，改名避免与管线混淆 |
| **Effect** | 对世界的一次具体变更 | 见 §9 |

## 3. 信封与帧

```ts
interface Envelope {
  readonly id: number;              // 包号，用于溯源；同一 packet 内唯一
  readonly tag: string;             // 命名空间标签："core.move"
  readonly params: JsonValue;       // 递归 JSON，结构由 tag 的签名决定
  readonly refs: readonly ObjectRef[]; // 句柄，与纯数据分开
  readonly priority?: number;       // 实例级参数，默认 0
  readonly children?: readonly Envelope[]; // 子调用
}

interface ObjectRef {
  readonly handle: number;          // 由 store / 解析器分配
  readonly kind: "entity" | "space";
}
```

**作者写的东西里没有时间。** 时间、来源、深度都是运行期的，由框架补：

```ts
interface Frame {
  readonly envelope: Envelope;
  readonly source: string;          // 谁发起的："player" / "rule:combat" / "ai"
  readonly lTick: number;
  readonly seq: number;
  readonly depth: number;
  readonly parentId: number | null;
}
```

## 4. 标签

- 作者写**字符串**：`^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){1,3}$`
- 加载时转成**整数**（sym），运行期只用整数。
- 命名空间归谁：

| 前缀 | 归属 |
|---|---|
| `core.*` | 内核 |
| `world.*` | 世界包 |
| `user.*` | 玩家 / mod |
| `x-*` | 私有扩展，不参与冲突检查 |

- **同一个标签注册两次 = 加载期报错**，不允许覆盖。

## 5. 签名

每个标签必须注册一份签名，否则等于不存在。

```ts
interface Signature {
  readonly tag: string;
  readonly params: Schema;          // 参数结构
  readonly result: Schema;          // 返回类型
  readonly returnsEffects: boolean; // 返回的是不是 Effect[]
  readonly needsTimestamp: boolean; // 函数自己声明，不由包声明
  readonly pure: true;              // v0 只允许纯函数
}
```

`Schema` 是一个极小的类型语言，够校验、能序列化、不依赖第三方库：

```ts
type Schema =
  | { t: "int" } | { t: "num" } | { t: "str" } | { t: "bool" } | { t: "null" }
  | { t: "enum"; values: readonly (string | number)[] }
  | { t: "array"; of: Schema; max?: number }
  | { t: "object"; fields: Record<string, Schema>; optional?: readonly string[] }
  | { t: "any" };
```

规则：

- **未知字段默认拒绝**；私有扩展必须放在 `x-` 开头的字段里。
- `int` 必须是安全整数；`num` 拒绝 `NaN` / `Infinity`。
- 数组和对象都要有大小上限（默认 256 项 / 16 层）。

## 6. 求值

1. **后序**：先求值全部 `children`（按数组顺序，从左到右），再把结果和 `params` 一起交给父函数。
2. **深度**：默认上限 3，世界包可配置，硬上限 8。超限即失败。
3. **不缓存**：同一个标签在一个 tick 内被调用两次，就执行两次。缓存属于上层优化，不在契约里。
4. **无隐式状态**：函数只能通过 `params` / `refs` / 只读视图获取信息。
5. **不写世界**：函数返回纯数据；世界变更只能表达为结果里的 Effect，由 store 统一应用。

## 7. 失败语义

| 层级 | 行为 |
|---|---|
| **单个 Envelope** 失败 | 该节点结果为 `Error`，记一条诊断；兄弟节点继续 |
| **父节点** 拿到子节点的 `Error` | 父节点也失败（级联），v0 不支持容错 |
| **整个 packet** 全部失败 | packet 失败 → 抛出 → **中止当前 tick**，游戏停下 |
| **加载期** 失败（签名、引用、哈希） | 直接拒绝世界包，不进入运行 |

诊断必须包含：`tag`、`envelope.id`、`lTick`、错误信息（人话）、出错的字段路径。

**绝不静默降级。** 世界可以少发生一件事，但不能发生一件没人知道的事。

## 8. 只读视图

规则读世界只有一条通道，**没有第二条**。

```ts
interface WorldView {
  readonly tick: number;
  space(id: number): SpaceView;
  // 将来：entity(handle) / knowledge(...)
}

interface SpaceView {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  terrainAt(cell: Cell): number;
  occupantsAt(cell: Cell): readonly Handle[];
  each(origin: Cell, offsets: readonly Offset[], visit: (cell: Cell) => void): void;
}
```

三条规矩：

1. **WorldView 只做路由**。每个领域自己长自己的查询，别让它变成一个巨型接口。
2. **不返回可变对象**。`Space` 本身不能交出去，否则规则能绕过 store 直接写。
3. **判断标准**：规则需要它吗？不需要就别放进来。

**渲染不读 WorldView。** 渲染要的是批量数据，走独立快照：

```ts
interface FrameSnapshot {
  readonly width: number;
  readonly height: number;
  readonly terrain: Int32Array;
  readonly occupants: ReadonlyMap<number, readonly number[]>;
}
```

点查询给规则，快照给渲染。两条路径，互不打扰。

### 缓存

求值期间世界是静止的（写只发生在 `store.step()`），所以缓存可以**零失效**：

```
求值开始 → 建空 Map → 查询时记录 → 求值结束 → 整个丢掉
```

v0 **不做**。先测量，再优化。

## 9. 效果是数据

效果不是特殊类型，就是 JSON 数组，放在结果的 `effects` 字段里：

```json
{ "damage": 12, "effects": [{ "kind": "terrain", "space": 1, "cell": { "x": 2, "y": 3 }, "value": 5 }] }
```

- 子函数返回它，父函数可以合并、过滤、丢弃；
- **只有根节点收集到的效果才交给 store**；
- 非根节点的效果**默认丢弃**，必须由父节点显式合并——谁授权了改动，调用树上看得见。

这样：

1. 只有一种类型（JSON），schema 能校验，哈希能算；
2. 技能 = 若干子效果拼起来，可组合；
3. 应用前就是数据，能打日志、能 diff、能被 AI 生成。

## 10. 链接与哈希

链接产物：

```
LinkTable {
  tags: Map<string, number>        // 名字 → 整数
  signatures: Map<number, Signature>
  handlers: Map<number, Handler>   // 运行期直接调用
  hash: string                     // 上述内容的哈希
}
```

- 哈希参与世界包的身份。同一份包 + 同一份链接 = 同一个世界。
- 运行期不校验：信任来自「加载期校验过 + 哈希未变」。
- **不可信来源**（网络、运行时 AI 生成）必须重新校验，不能复用已链接的表。

## 11. 扩展与版本

| 想做什么 | 做法 | 兼容性 |
|---|---|---|
| 加一种玩法 | 新标签 + 新签名 | 完全兼容 |
| 给已有标签加字段 | 加**可选**字段，签名 minor +1 | 向后兼容 |
| 改字段含义 | **新标签**，旧的标记废弃 | 不兼容但合法 |
| 加私有字段 | `x-` 前缀，不进签名 | 完全兼容 |

规则：**只增不改**。删字段、改语义，一律开新标签。

## 12. 明确不做（v0）

- 运行时动态注册标签（要重新链接）。
- 函数的副作用（v0 全是纯函数）。
- 多标签订阅（一个包一个标签）。
- 跨 tick 的包（长动作是另一种数据类型，不是包）。
- 独立的直连通道（由「链接后直接调用」实现，不再是单独机制）。

## 13. 未定

1. `EntityView` / `KnowledgeView` 的形状（等实体层出现）。
2. 容错语法（父节点怎么接住子节点的 `Error`）——v0 不支持，v1 再议。
3. 诊断写到哪（事件日志还是单独通道）。
