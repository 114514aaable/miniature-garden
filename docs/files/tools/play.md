# `tools/play.mjs`

## 内容

从文件夹加载一个世界并画出来（宿主侧）。
用法：
node tools/play.mjs game/worlds/official.base game/worlds/official.normal
它做的每一步都是真的：读包 → 依赖排序 → 合并 → 加载 → 造 store → 放实体。
只是最后没有交互，只是把世界画出来，让你看见「文件变成了世界」。

行数：88

## 接口

（没有导出）
## 依赖

- [`game/engine/core/src/pack/init.ts`](game/engine/core/src/pack/init.md)
- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`game/engine/core/src/pack/merge.ts`](game/engine/core/src/pack/merge.md)
- [`game/engine/core/src/pack/order.ts`](game/engine/core/src/pack/order.md)
- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`tools/pack-reader.mjs`](tools/pack-reader.md)

## 被引用

（没有别的文件引用它）
