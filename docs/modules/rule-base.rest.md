# 休息

`base.rest` — 花 4 回合喘口气，恢复 2 点血。

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

- 名字：休息
- 成本键：`wait`（查 world.json 的 clock.costs）
- 目标：self，射程 0

产出效果：是（Effect[]）
