# LOOP 墙钟协议（到 2026-08-21 23:00 CST）

## 唯一停机条件

1. `date` 显示 `>= 2026-08-21 23:00:00`（Asia/Shanghai）
2. 用户本回合明确说停 / 结束 LOOP

下列**不是**停机条件：测试全绿、AC 打勾、需要汇报、短回复规则、子任务做完、回合要 yield。

## 回合 yield 设计

聊天必须结束一轮时：

1. 先把下一票写进 `queue.md` 并标 `in_progress`
2. 再派 **background** 子代理按本协议接着干（`subagent_type=general`，最多合计 10）
3. 用户下一句无论是「继续」还是别的 LOOP 相关话，视为续跑信号，**先读 queue 执行**，禁止再问要不要做

禁止：绿了就停；写完总结等用户；把「设计完」当成完成。
**一票做完必须立刻拆下一票并开工，直到墙钟。** 禁止 login-error 空转守门。
**禁止移动端**：不改 `/m`、`Mobile*` 页面，不加 `/m/*` e2e。

## 每票循环

```
date 检查停机
→ 读 queue.md 第一条 pending/in_progress
→ 做完勾 done，立刻下一条
→ 队列空：从 router 再拆 heading 未覆盖路径，写入 queue
→ 重复直到停机
```

## 约束

- 不换皮、无设计稿不 ui-replica、不 commit（除非用户点名）
- 测试红修实现或 mock，禁止 skip
- MySQL 起不来：记下，跳过真后端，不闲等
- 进度只追加 `queue.md` 与 journal，不打断循环
