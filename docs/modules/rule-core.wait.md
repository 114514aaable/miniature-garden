# 等待

`core.wait` — 什么都不做，只让时间前进一回合。

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

- 名字：等待
- 成本键：`wait`（查 world.json 的 clock.costs）
- 目标：self，射程 0

产出效果：是（Effect[]）
