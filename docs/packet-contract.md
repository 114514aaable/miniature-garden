# 数据包契约 v0.1（草案）

> 状态：定稿前的最后一版草案。写完就按它实现。
> 目标：**第三方只看这份文档，就能独立实现一个兼容的解析器。**

## 0. 一句话

世界的行为 = 一棵**调用树**。每个节点是一个带标签的数据包，标签决定调用哪个函数，
函数是纯的，只返回结果；世界由 store 落地。

## 1. 两段模型

| 阶段 | 发生什么 | 能不能省 |
|---|---|---|
| **加载期**（一次） | 解析标签、校验签名、建立调用图、算哈希 | 不能 |
| **运行期**（每 tick） | 直接调用已链接的函数、收集结果、提交给 store | 跳过校验 |

运行期不再解析、不再校验——这是合法的，因为**链接之后图不可变**。
改了图就必须重新链接，哈希会变。

## 2. 信封（作者视角）

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
  readonly source: string;          // 谁发起的（"player" / "rule:combat" / "ai"）
  readonly lTick: number;
  readonly seq: number;
  readonly depth: number;
  readonly parentId: number | null;
}
```

## 3. 标签

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

## 4. 签名

每个标签必须注册一份签名，否则等于不存在。

```ts
interface Signature {
  readonly tag: string;
  readonly params: Schema;          // 参数结构
  readonly result: Schema;          // 返回类型（v0 一律是纯数据）
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

## 5. 求值规则

1. **后序**：先求值全部 `children`（按数组顺序，从左到右），再把结果和 `params` 一起交给父函数。
2. **深度**：默认上限 3，世界包可配置，硬上限 8。超限即失败。
3. **不缓存**：同一个标签在一个 tick 内被调用两次，就是执行两次。缓存属于上层优化，不在契约里。
4. **无隐式状态**：函数只能通过 `params` / `refs` / 只读的 `WorldView` 获取信息。
5. **不写世界**：函数返回纯数据；任何世界变更必须表达为结果里的「变更描述」，由 store 统一应用。

## 6. 失败语义

| 层级 | 行为 |
|---|---|
| **单个 Envelope** 失败 | 该节点结果为 `Error`，记一条诊断；兄弟节点继续 |
| **父节点** 拿到子节点的 `Error` | 父节点也失败（级联），除非它自己声明了容错（v0 不支持） |
| **整个 packet** 全部失败 | packet 失败 → 抛出 → **中止当前 tick**，游戏停下 |
| **加载期** 失败（签名、引用、哈希） | 直接拒绝世界包，不进入运行 |

诊断必须包含：`tag`、`envelope.id`、`lTick`、错误信息（人话）、以及出错的字段路径。

**绝不静默降级。** 世界可以少发生一件事，但不能发生一件没人知道的事。

## 7. 链接与哈希

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

## 8. 扩展与版本

| 想做什么 | 做法 | 兼容性 |
|---|---|---|
| 加一种玩法 | 新标签 + 新签名 | 完全兼容 |
| 给已有标签加字段 | 加**可选**字段，签名 minor +1 | 向后兼容 |
| 改字段含义 | **新标签**，旧的标记废弃 | 不兼容但合法 |
| 加私有字段 | `x-` 前缀，不进签名 | 完全兼容 |

规则：**只增不改**。删字段、改语义，一律开新标签。

## 9. 明确不做（v0）

- 运行时动态注册标签（要重新链接）。
- 函数的副作用（v0 全是纯函数）。
- 多标签订阅（一个包一个标签）。
- 跨 tick 的包（长动作是另一种数据类型，不是包）。
- 直连通道（StableLink 的思想由「链接后直接调用」实现，不再是独立机制）。

## 10. 未定

1. `WorldView` 的具体形状（只读查询接口）。
2. 结果里的「变更描述」用什么类型（目前是 `Effect[]`，但 v0 只允许它出现在结果里，不能中途写）。
3. 容错语法（父节点怎么处理子节点的 `Error`）——v0 不支持，v1 再议。
4. 诊断的记录位置（写进事件日志还是单独的诊断通道）。
