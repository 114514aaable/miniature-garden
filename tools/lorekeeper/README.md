# tools/lorekeeper/

知识解析 / 对话服务。许可：**AGPL-3.0-or-later**。独立进程，通过 localhost HTTP 为引擎服务。

## 职责

1. **知识检索**：给定 NPC + 当前局面，按可见性、区域聚类、势力归属、事件记录筛选知识条目。
2. **预算裁剪**：按 `npc.tier` 截断到上下文预算，按显著性排序。
3. **台词生成**（可选）：把「选中的动作 + 相关知识」变成一句人话。不接模型时返回 T0 模板。
4. **分级路由**：T0 直接返回模板；T1 调本地模型；T2 调云端模型。

## 接口草案

```http
POST /speak
{
  "npc": "npc_salt",
  "situation": { "region": "dock", "turn": 12, "events": ["ev_..."] },
  "player_utterance": "你弟弟的事，我听说了。"
}
→
{
  "line": "听着，这话在这儿说，是要死人的。",
  "mood": "wary",
  "knowledge_used": ["k_salt_debt"],
  "tier": 1
}
```

引擎只消费 `line` 与 `mood`；`knowledge_used` 用于调试与「NPC 说漏嘴」的判定。

## 约束

- 服务不写世界，不写存档，不做判定。它是只读的。
- 模型不可用时返回模板台词，不报错、不阻塞。
- 所有注入上下文的知识条目必须能在世界包里找到 id，不允许模型自由编造设定。
