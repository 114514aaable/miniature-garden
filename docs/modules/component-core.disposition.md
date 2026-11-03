# 阵营

`core.disposition` — 敌对 / 中立 / 友好，决定点击默认行为。

## Schema
```json
{
  "t": "object",
  "fields": {
    "value": {
      "t": "enum",
      "values": [
        "hostile",
        "neutral",
        "friendly"
      ]
    }
  }
}
```
