# 走一步

`core.move` — 朝一个方向移动一格，成本由速度决定。

## 参数
```json
{
  "t": "object",
  "fields": {
    "handle": {
      "t": "int"
    },
    "space": {
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

- 名字：走一步
- 成本键：`move`（查 world.json 的 clock.costs）
- 目标：cell，射程 1

产出效果：是（Effect[]）
