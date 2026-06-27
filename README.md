# IELTS Vocabulary Web App v3.0.1 Speaking Hotfix

这是 v3.0.1 口语训练热修版。

## 修复内容

v3.0 的“口语30秒”会调用 `/api/training/words?mode=output`。旧数据库里可能没有 `learning_status.reviewed_at` 字段，导致接口报错，并在前端显示成“未登录”。

v3.0.1 修复：

```text
不再依赖 reviewed_at 字段
输出训练优先使用已学词
如果没有已学词，则自动回退到词库前面的词
错误信息更清楚
```

## 口语模式怎么用

口语模式目前是“口语任务卡”，不是自动录音评分：

```text
1. 进入 雅思 → 口语30秒
2. 系统给 3–5 个目标词
3. 看题目
4. 用这些词开口说 30 秒
5. 可选在文本框写关键词
6. 点“显示答案 / 参考”看参考方向
7. 点下一题
```

## 部署

覆盖 GitHub 仓库后 Push，Vercel 自动重新部署。

环境变量不用改。
