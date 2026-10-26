# 新世界 · New World（暂定名）

> 一个先有规则、后有故事的开源世界。
> 没有 LLM 也能完整地玩；接上 LLM，世界才会开口说话。

**状态：早期脚手架。** 仓库里目前只有规范草案、示例世界包和一个校验器，还没有可运行的游戏。

## 为什么做这个

SillyTavern 是一个很好的聊天前端，但它不会拒绝你、不会推进世界、也不会让你输。

我们想要的是一个**会说不的酒馆**：有部位、有回合、有地形、有代价；NPC 有自己的目标和
知道的与不知道的事；语言模型只负责让这一切说人话，而不是替它做决定。

## 三条设计原则

1. **生成时用 LLM，运行时零 LLM。** 世界在离线时被「编译」成数据，之后游戏完全确定性运行。
   成本是一次性的，产物可离线、可测试、可 diff、可分享。
2. **规则是权威，模型是翻译官。** 判定、数值、合法性全部由引擎决定；模型只做选动作、说人话。
   模型挂掉，游戏照常能玩。
3. **世界包是数据，不是代码。** 写世界观的人不需要懂引擎，PR 也好审。

## 仓库结构

```
engine/            游戏引擎（MIT）—— 权威规则、回合、部位、网格
tools/worldgen/    世界生成器 CLI（AGPL-3.0-or-later）—— 离线生成世界包
tools/lorekeeper/  知识解析 / 对话服务（AGPL-3.0-or-later）—— 独立进程，按需接 LLM
tools/validate/    世界包校验器（AGPL-3.0-or-later）—— schema + 引用完整性
spec/              世界包规范与 JSON Schema（CC-BY-4.0）
worlds/official/   官方世界「灰港」（CC-BY-SA-4.0）
examples/          最小可用世界包（CC0-1.0）
content/           角色卡、世界书、prompt 模板（CC-BY-SA-4.0）
docs/              设计文档（CC-BY-4.0）
```

## 现在能做什么

```bash
python tools/validate/validate.py worlds/official examples/minimal-world
```

校验器会检查 JSON Schema、ID 唯一性、跨文件引用（区域父级、实体归属、知识归属、出生点）。

## 参与方式

见 [CONTRIBUTING.md](CONTRIBUTING.md)。简单说：fork、改、`git commit -s`（DCO 签名）、
跑一遍校验、提 PR。世界包和引擎代码分开收。

## 许可

| 范围 | 路径 | 许可 |
|---|---|---|
| 引擎 | `engine/` | MIT |
| 生成器 / 服务 / 工具 | `tools/` | AGPL-3.0-or-later |
| 规范与文档 | `spec/`, `docs/` | CC-BY-4.0 |
| 官方世界包 | `worlds/` | CC-BY-SA-4.0 |
| 角色卡与内容 | `content/`, `assets/` | CC-BY-SA-4.0 |
| 示例 | `examples/` | CC0-1.0 |

逐文件的许可声明见 [LICENSING.md](LICENSING.md) 与 `REUSE.toml`。

## 路线图

- [x] 仓库骨架、许可矩阵、世界包规范草案
- [x] 校验器与两个可校验的世界包
- [ ] 引擎垂直切片：一张 8×8 地图、部位技能、两个 NPC、回合与行动点
- [ ] 世界生成器 CLI（提案 → 校验 → 批评 → 修复）
- [ ] 知识解析服务（区域聚类 + 保密级 + 预算分级）
- [ ] itch.io 首次公开构建（Name your own price，最低 $0）

## 不做什么

- 不做实时制。回合制给了 LLM 思考的时间，也给了玩家读台词的时间。
- 不做「所有内容都靠模型现编」。世界是编译产物，不是每次对话的即兴产物。
- 不做付费墙。所有内容永久免费，赞助只是赞助。
