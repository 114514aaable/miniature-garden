# 文档索引

> 给人和 AI 看的都在这。**先读哪份**取决于你要做什么。

| 想做什么 | 读这份 |
|---|---|
| 写一个世界包（第一次） | [pack-guide.md](pack-guide.md) |
| 查某个规则/组件/模板的契约 | [modules/README.md](modules/README.md)（机器可读：[modules/index.json](modules/index.json)） |
| 理解整体设计 | [architecture.md](architecture.md) |
| 看要做什么、不做什么 | [requirements.md](requirements.md) |
| 事件与效果的契约细节 | [packet-contract.md](packet-contract.md) |

## 自动生成，别手改

- `docs/modules/` 全部由 `node tools/gen-docs.mjs` 生成；
- 名字与介绍来自 `game/locales/zh-CN.json`；
- 参数来自规则签名，schema 来自包定义。

改文档 = 改语言包或改代码，然后重新生成。

## 给 AI 的最短路径

```
1. docs/modules/index.json        筛出要用的模块
2. docs/modules/<那几篇>.md       读契约
3. docs/pack-guide.md             照着写包
4. node tools/play.mjs 验证
```
