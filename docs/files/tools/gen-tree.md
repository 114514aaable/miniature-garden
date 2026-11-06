# `tools/gen-tree.mjs`

## 内容

扫源码里的 import，画一张引用树。
用法：node tools/gen-tree.mjs [--out docs/dependency-tree.md]
只做三件事：
1. 抽出每个文件的相对 import（忽略 'node:xxx' 与 /web|/client 这类浏览器路径）
2. 从入口开始深度优先，标出环
3. 输出「树」+「被谁引用」两张表

行数：188

## 接口

（没有导出）
## 依赖

（无）

## 被引用

（没有别的文件引用它）
