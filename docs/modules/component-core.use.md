# 用法

`core.use` — 这东西怎么用：效果列表 + 是否消耗。

## Schema
```json
{
  "t": "object",
  "fields": {
    "effects": {
      "t": "array",
      "of": {
        "t": "any"
      },
      "max": 16
    },
    "consume": {
      "t": "bool"
    }
  },
  "optional": [
    "consume"
  ]
}
```
