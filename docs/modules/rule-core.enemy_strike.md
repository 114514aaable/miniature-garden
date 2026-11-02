# 敌人出手

`core.enemy_strike` — 按意图里的格子结算伤害；玩家不在格子里就落空。

## 参数
```json
{
  "t": "object",
  "fields": {
    "enemy": {
      "t": "int"
    },
    "target": {
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

产出效果：是（Effect[]）
