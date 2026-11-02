# 劈砍

`core.attack` — 攻击相邻格里的一个目标，伤害 = 攻击 − 防御。

## 参数
```json
{
  "t": "object",
  "fields": {
    "actor": {
      "t": "int"
    },
    "x": {
      "t": "int"
    },
    "y": {
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

- 名字：劈砍
- 成本键：`attack`（查 world.json 的 clock.costs）
- 目标：entity，射程 1

产出效果：是（Effect[]）
