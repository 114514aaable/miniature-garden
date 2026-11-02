# 使用

`core.use` — 把背包里的东西用出去，效果由物品自己声明。

## 参数
```json
{
  "t": "object",
  "fields": {
    "actor": {
      "t": "int"
    },
    "item": {
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

- 名字：使用
- 成本键：`take`（查 world.json 的 clock.costs）
- 目标：self，射程 0

产出效果：是（Effect[]）
