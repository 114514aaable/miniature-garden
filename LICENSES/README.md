# 许可全文

本目录存放各许可证的完整文本，供 [REUSE](https://reuse.software/) 检查使用。

| 文件 | SPDX |
|---|---|
| `MIT.txt` | `MIT` |
| `AGPL-3.0-or-later.txt` | `AGPL-3.0-or-later` |
| `CC-BY-4.0.txt` | `CC-BY-4.0` |
| `CC-BY-SA-4.0.txt` | `CC-BY-SA-4.0` |
| `CC0-1.0.txt` | `CC0-1.0` |

> **注意：`MIT.txt` 之外的四个文件需要在有网络的环境下补齐**（本机初始化时网络不可用）。
> 补齐方法（任选其一）：
>
> ```bash
> # 推荐：REUSE 官方工具，会按 SPDX 标识自动下载
> pipx install reuse
> reuse download AGPL-3.0-or-later CC-BY-4.0 CC-BY-SA-4.0 CC0-1.0
> ```
>
> 或手动下载：
>
> - AGPL-3.0-or-later: <https://www.gnu.org/licenses/agpl-3.0.txt>
> - CC-BY-4.0: <https://creativecommons.org/licenses/by/4.0/legalcode.txt>
> - CC-BY-SA-4.0: <https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt>
> - CC0-1.0: <https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt>

文件缺失期间 `reuse lint` 会报错，这是预期行为，补齐即可。
