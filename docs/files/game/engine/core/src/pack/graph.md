# `game/engine/core/src/pack/graph.ts`

## 内容

世界结构图：把「这个包里到底有什么、谁引用谁」画出来。
它不参与加载，是一张只读的图——所以启动器能拿它做结构预览，
以后也能拿它做「关掉这一块会破坏什么」的分析。
节点 id 形如 "template:pc"，引用边是 id 字符串。

行数：134

## 接口

### 函数 `buildGraph`

```ts
function buildGraph(merged: MergedWorld, rules: readonly string[] = []): WorldGraph
```

### 接口 `GraphNode`

```ts
interface GraphNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly label: string;
  readonly origin: string;
  readonly refs: readonly string[];
  readonly usedBy: readonly string[];
}
```

### 函数 `nodeId`

```ts
function nodeId(kind: NodeKind, id: string | number): string
```

### 类型 `NodeKind`

```ts
type NodeKind = "component" | "template" | "entity" | "space" | "terrain" | "rule" | "world"
```

### 接口 `WorldGraph`

```ts
interface WorldGraph {
  readonly nodes: readonly GraphNode[];
  readonly byId: ReadonlyMap<string, GraphNode>;
}
```

## 依赖

- [`game/engine/core/src/pack/merge.ts`](game/engine/core/src/pack/merge.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`tools/gen-pack-graph.mjs`](tools/gen-pack-graph.md)
- [`tools/serve.mjs`](tools/serve.md)
