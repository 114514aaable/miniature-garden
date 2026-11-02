# 部位

`core.body` — 分部位的血量与状态，供以后的部位战斗使用。

## Schema
```json
{
  "t": "object",
  "fields": {
    "parts": {
      "t": "array",
      "of": {
        "t": "object",
        "fields": {
          "id": {
            "t": "str"
          },
          "name": {
            "t": "str"
          },
          "hp": {
            "t": "int"
          },
          "max": {
            "t": "int"
          },
          "armor": {
            "t": "int"
          },
          "state": {
            "t": "enum",
            "values": [
              "ok",
              "hurt",
              "disabled"
            ]
          }
        },
        "optional": [
          "hp",
          "armor",
          "state"
        ]
      }
    }
  }
}
```
