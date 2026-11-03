# 敌人起手

`core.enemy_windup` — 敌人写下攻击意图，两回合后才结算，期间可以被躲开。

## 参数
```json
{
  "t": "object",
  "fields": {
    "enemy": {
      "t": "int"
    },
    "dx": {
      "t": "int"
    },
    "dy": {
      "t": "int"
    },
    "damage": {
      "t": "int"
    },
    "ticks": {
      "t": "int"
    },
    "mode": {
      "t": "str"
    }
  },
  "optional": [
    "mode"
  ]
}
```

## 返回
```json
{
  "t": "any"
}
```

产出效果：是（Effect[]）
