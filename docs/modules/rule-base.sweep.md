# 横扫

`base.sweep` — 打自己周围一圈里所有活着的目标。

## 参数
```json
{
  "t": "object",
  "fields": {
    "actor": {
      "t": "int"
    },
    "shape": {
      "t": "str"
    },
    "filter": {
      "t": "str"
    }
  },
  "optional": [
    "shape",
    "filter"
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

- 名字：横扫
- 成本键：`attack`（查 world.json 的 clock.costs）
- 目标：area，射程 0

产出效果：是（Effect[]）
