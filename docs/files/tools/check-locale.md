# `tools/check-locale.mjs`

## 内容

语言包体检：包里每个 id 都应该有名字。
查三类：
1. 组件 / 模板 / 地形 / 世界 —— 有没有 name、desc
2. 规则 —— 只看 RULE_TABLE 里的 tag
3. 语言包里没人用的键（可选，提示用）
用法：node tools/check-locale.mjs

行数：99

## 接口

（没有导出）
## 依赖

- [`game/systems/rules/index.ts`](game/systems/rules/index.md)

## 被引用

（没有别的文件引用它）
