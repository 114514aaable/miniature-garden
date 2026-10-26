# 参与贡献

## 先做什么

不确定从哪开始？看 [README 的路线图](README.md#路线图)，或者挑一个 `good first issue`。
世界包内容（`worlds/`、`content/`）和引擎代码（`engine/`）是两条独立的贡献路径，不需要都懂。

## 提交前

```bash
python tools/validate/validate.py worlds/official examples/minimal-world
```

改动了世界包或 schema 的 PR，必须让这条命令通过。CI 也会跑同样的事。

## 提交规范

- 一个 PR 只做一件事。格式化、重构、功能混在一起会被要求拆分。
- 提交信息用祈使句：`add: 矿道第三层区域`、`fix: 校验器漏检 exits 单向`。
- **必须带 DCO 签名**：

  ```bash
  git commit -s -m "add: 矿道第三层区域"
  ```

  `-s` 会追加 `Signed-off-by: 你的名字 <邮箱>`。这表示你有权按本仓库的许可提交这份贡献。
  本项目不使用 CLA——你保留版权。

## 内容规则

- `worlds/official/` 与 `content/` 默认**非露骨**。成人向内容请自建世界包、自行发布，不要进官方目录。
- **不要提交 AI 批量生成、未经人工编辑的内容。** 判断标准很简单：你能为每一条设定说出
  「为什么是它」吗？说不出就是灌水。
- 引用他人作品（设定、名字、图像）前确认许可。同人二创请放在自己的世界包里，并在 `manifest.json`
  注明来源。
- 知识条目要独立可读：禁止「如上所述」「他」「那个东西」这类依赖上下文的指代，因为它们会被
  单独塞进 NPC 的上下文窗口。

## 代码规则

- 引擎代码（`engine/`）用 MIT，工具（`tools/`）用 AGPL-3.0-or-later。**不要把 AGPL 代码 import
  进引擎进程**，见 [LICENSING.md](LICENSING.md)。
- 每个源文件带 SPDX 头：

  ```
  // SPDX-FileCopyrightText: 2026 newworld contributors
  // SPDX-License-Identifier: MIT
  ```

- 新增依赖前先开 issue 讨论。引擎的目标是「零依赖也能跑」。

## 审阅

- 世界包：看设定是否自洽、知识条目是否可独立注入、引用是否闭合。
- 引擎：看是否保持了「规则权威、模型翻译」的边界，以及是否引入了对 LLM 的硬依赖。

## 行为准则

对人不对事，不搞人身攻击。技术分歧用基准和例子说话。
