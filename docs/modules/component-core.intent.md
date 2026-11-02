# 意图

`core.intent` — 敌人下回合要打的格子与结算时刻，绘制和判定共用。

## Schema
```json
{
  "t": "object",
  "fields": {
    "kind": {
      "t": "str"
    },
    "tiles": {
      "t": "array",
      "of": {
        "t": "object",
        "fields": {
          "dx": {
            "t": "int"
          },
          "dy": {
            "t": "int"
          }
        }
      }
    },
    "damage": {
      "t": "int"
    },
    "resolveAt": {
      "t": "int"
    }
  }
}
```
