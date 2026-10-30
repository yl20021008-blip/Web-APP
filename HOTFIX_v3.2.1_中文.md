# v3.2.1 学习加载修复

包含v3.2.0全部功能：分阶段复习/新词、语境故事、关键词RAG来源显示、回忆表达、自查和总结。

本次修复：
- 单词请求20秒超时后显示提示，不再无限等待。
- 加载错误提供重新加载按钮。
- 今日学习第一步可点击“先学新词，稍后再复习”；异常步骤可跳过。跳过不会标记单词已学。
- 复习只查询到期词，新词只查询新词，不再互相等待。
- 校验数量参数。

如何安装：备份原Web-APP本地文件夹；将本包Web-APP-v3.2.1文件夹内部内容覆盖仓库根目录；保留.git和.env.local；GitHub Desktop Commit摘要Fix vocabulary loading v3.2.1，再Push origin。Vercel部署Ready后Ctrl+F5刷新，版本应为v3.2.1。
没有新增环境变量或数据库迁移，原Groq与数据库配置保留。

使用：今日学习等待词卡出现；如果超过20秒，截图红色提示；可先点击“先学新词”或底部“新词”测试另一入口。如果两个入口都失败，需要检查/api/study/today请求响应和Vercel Runtime Logs。不要反复重装数据库。

验证：构建/类型检查；node scripts/test-guided-tasks.cjs（两阶段各一次查询）；node scripts/test-story-flow.cjs；node scripts/test-rag.cjs。未登录真实生产账号验证，不保证数据库或网络问题已消除。截图只证明界面当时处于等待状态，具体慢请求原因仍需实际接口响应确认。
学习框架与RAG边界详见START_HERE_v3.2_中文.md。
