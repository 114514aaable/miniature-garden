# 蓄力劈砍

`base.cast` — 先挂起，过几回合再结算；期间可以被打断。

## 参数
```json
{
  "t": "object",
  "fields": {
    "actor": {
      "t": "int"
    },
    "tag": {
      "t": "str"
    },
    "x": {
      "t": "int"
    },
    "y": {
      "t": "int"
    },
    "ticks": {
      "t": "int"
    }
  },
  "optional": [
    "tag",
    "ticks"
  ]
}
```

## 返回
```json
{
  "t": "any"
}
```

## 作为技能

- 名字：蓄力劈砍
- 成本键：`wait`（查 world.json 的 clock.costs）
- 目标：entity，射程 1

产出效果：是（Effect[]）
