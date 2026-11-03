# 交谈

`base.talk` — 和旁边的角色说话；对话不花时间。

## 参数
```json
{
  "t": "object",
  "fields": {
    "actor": {
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

## 作为技能

- 名字：交谈
- 成本键：`talk`（查 world.json 的 clock.costs）
- 目标：entity，射程 1

产出效果：是（Effect[]）
