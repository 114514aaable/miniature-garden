# 世界包规范 v0.1.0（草案）

世界包 = 一个目录 + 四个 JSON 文件。没有代码，没有脚本，没有外部依赖。

```
my-world/
├── manifest.json      # 清单：id、版本、许可、入口、出生点
├── regions.json       # 区域：地理、聚类键、地形、危险度
├── entities.json      # 实体：地点、势力、NPC、物品、生物
└── knowledge.json     # 知识：谁知道什么、谁知道多少
```

## 设计意图

**生成器写这四份文件，引擎读这四份文件。** 中间没有任何隐式状态，所以：

- 世界包可以 `git diff`、可以 code review、可以手工修；
- 同一个包在纯规则模式和接 LLM 模式下必须表现一致；
- 换引擎、换语言重写引擎，都不需要重新生成世界。

## 四条约定

1. **ID 是地址。** 所有 id 采用 `^[a-z][a-z0-9_-]{2,47}$`，全局唯一、跨文件引用。
   不要用中文、不要用递增数字、不要包含版本号——版本由 `manifest.version` 表达。
2. **所有引用必须闭合。** `parent`、`region`、`exits`、`factions`、`holders`、`start.spawn`
   指向的 id 必须存在。校验器会拦。
3. **知识条目是独立可注入的最小单位。** 每条都应脱离上下文也能读懂，因为它们会被单独塞进
   NPC 的上下文窗口。禁止「如上所述」「他」这类指代。
4. **`props` 是逃生舱，不是垃圾桶。** 只放引擎或模组真的会读的标量。结构化数据请提 schema 变更。

## 校验

```bash
python tools/validate/validate.py <世界包目录> [更多目录...]
```

校验内容：JSON Schema、id 唯一性、跨文件引用完整性、`exits` 双向性、出生点存在性。

## 版本策略

- `spec_version` 是规范版本，不兼容变更才递增；当前只有一个值 `0.1.0`。
- `version` 是世界包自身的语义化版本。
- 引擎按 `spec_version` 选择解析器，不认识的版本直接拒绝加载并给出人话报错。

## 分发

itch.io 上一个世界包 = 一个项目页（附 zip）+ 一条索引记录。索引是一个 JSON 文件，
字段与 `manifest.json` 对齐，托管在仓库里，任意客户端都可以拉取。

```json
{
  "packs": [
    {
      "id": "grey-harbor",
      "name": "灰港",
      "version": "0.1.0",
      "author": "newworld contributors",
      "license": "CC-BY-SA-4.0",
      "url": "https://example.itch.io/grey-harbor",
      "sha256": "…"
    }
  ]
}
```

Workhop 不存在，所以索引和校验哈希就是分发层。等生态起来了再谈自动更新。
