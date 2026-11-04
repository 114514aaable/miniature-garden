# 行动方式

`core.locomotion` — 能贴哪些面：ground（地面）、liquid（水里）、solid、air。

## Schema
```json
{
  "t": "object",
  "fields": {
    "surfaces": {
      "t": "array",
      "of": {
        "t": "str"
      },
      "max": 8
    }
  }
}
```
