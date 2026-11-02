# 捡起

`core.take` — 把脚下的物品放进背包。

## 参数
```json
{
  "t": "object",
  "fields": {
    "actor": {
      "t": "int"
    }
  }
}
```

## 返回
```json
{
  "t": "any"
}
```

## 作为技能

- 名字：捡起
- 成本键：`take`（查 world.json 的 clock.costs）
- 目标：self，射程 0

产出效果：是（Effect[]）
