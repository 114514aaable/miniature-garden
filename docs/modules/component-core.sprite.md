# 贴图

`core.sprite` — 指向图集里的一帧；没有就退回字符。

## Schema
```json
{
  "t": "object",
  "fields": {
    "sheet": {
      "t": "str"
    },
    "frame": {
      "t": "str"
    },
    "frames": {
      "t": "array",
      "of": {
        "t": "str"
      },
      "max": 64
    },
    "fps": {
      "t": "int"
    }
  },
  "optional": [
    "frame",
    "frames",
    "fps"
  ]
}
```
