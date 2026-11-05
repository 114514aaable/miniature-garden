# 身体

`core.body` — 手的数量。默认 2；四只手就写 4。

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
