# 放下

`core.drop` — 把背包里的第一件物品放到脚下。

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

- 名字：放下
- 成本键：`drop`（查 world.json 的 clock.costs）
- 目标：self，射程 0

产出效果：是（Effect[]）
