# 指向

`core.aim` — 判断某个技能能不能落在指定的格子上，供鼠标与 AI 共用。

## 参数
```json
{
  "t": "object",
  "fields": {
    "actor": {
      "t": "int"
    },
    "kind": {
      "t": "enum",
      "values": [
        "cell",
        "entity"
      ]
    },
    "range": {
      "t": "int"
    },
    "x": {
      "t": "int"
    },
    "y": {
      "t": "int"
    },
    "component": {
      "t": "str"
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

产出效果：否
