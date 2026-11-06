# `tools/gen-pack-graph.mjs`

## 内容

世界包的引用图（Mermaid）。
和 gen-tree（代码 import）互补：这里画的是**数据引用**
world → rules / space
entity → template
template → component
group → template
…
**不硬编码种类**：节点与边全部来自 buildGraph，新加一类定义自动出现。
用法：node tools/gen-pack-graph.mjs

行数：178

## 接口

（没有导出）
## 依赖

- [`game/engine/core/src/pack/graph.ts`](game/engine/core/src/pack/graph.md)
- [`game/engine/core/src/pack/merge.ts`](game/engine/core/src/pack/merge.md)
- [`game/engine/core/src/pack/order.ts`](game/engine/core/src/pack/order.md)
- [`tools/pack-reader.mjs`](tools/pack-reader.md)

## 被引用

（没有别的文件引用它）
