# `tools/gen-file-docs.mjs`

## 内容

每个源文件生成一篇 md（docs/files/...）。
为什么自动生成：手写的文件说明一定会和代码分叉。
这里只写「机器能确定的东西」：
文件头的说明、导出了什么、依赖谁、被谁依赖、有没有测试。
「为什么这么写」这类判断留给 docs/areas 与 docs/systems（手写）。
用法：node tools/gen-file-docs.mjs

行数：295

## 接口

（没有导出）
## 依赖

（无）

## 被引用

（没有别的文件引用它）
