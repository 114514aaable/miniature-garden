# AI 任务队列

外部 AI 在这里接活。协议：[`docs/base/ai-bridge.md`](../../docs/base/ai-bridge.md)

```
pending/    需求方写，AI 读
claimed/    AI 认领（rename，原子锁）
done/       AI 交付回执
failed/     失败原因
```

- 不要手改 `claimed/` 里的文件；认领权在 AI。
- 租约过期的任务可以被移回 `pending/`。
- 产物仍然放 `artdrop/inbox/<batch>/`，导入流程不变。
