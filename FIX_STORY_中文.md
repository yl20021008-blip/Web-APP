# v3.1.2 故事调用与展示修复

## 你现在只需这样操作
1. 备份本地Web-APP文件夹。解压本包，将Web-APP-v3.1.2文件夹内部全部内容覆盖现有Web-APP仓库根目录，保留.git和.env.local。根目录直接包含package.json、app、lib。
2. GitHub Desktop选择Web-APP，排除.idea等本机配置，Summary填 Fix AI story generation and legacy regeneration v3.1.2，Commit to main，再Push origin。
3. Vercel三个原变量保持：STORY_API_KEY=你的Groq Key；STORY_MODEL=openai/gpt-oss-20b；STORY_API_BASE_URL=https://api.groq.com/openai/v1。确保Production生效。不用新建Key、不用执行数据库SQL。
4. 等自动部署Ready。如果变量是在部署后才修改，重新Redeploy。
5. 打开网站Ctrl+F5，确认v3.1.2，登录并进入故事页。
6. 在旧故事卡片点击“将这些词改写为AI故事”，或顶部“生成新的AI故事”。等待结果。新故事保留旧记录并另存，出现“AI生成”和模型名；页面自动定位。
7. 刷新Groq密钥/Usage页核对调用是否产生。若生成失败，截图故事页的红色提示；不要展示Key。

## 修复内容
- 已学词不再因为用过旧模板就被排除；顶部默认按最近复习的词生成，允许重复，不会修改学习掌握状态。
- 旧模板不计入每日10组AI成功保存限额（滚动24小时）。
- 旧模板可按原词再生成；每次最多10词，较大旧故事会取其中最多10词。
- 新旧来源、时间、模型可见；英语优先、词汇高亮、中文折叠、展示记忆提示；旧Markdown双星号不再原样显示。
- 配置缺失、模型/地址错误、认证、限流、超时和内容校验失败在故事页显示。
- 提示词加入人物、目标、冲突、结局和语境词义要求；这属于生成约束，不保证每次语义都准确。

## 验证与边界
已通过npm run build、类型检查、git diff --check和node scripts/test-story-flow.cjs。测试覆盖旧模板词到达模型调用、模板不占AI限额、元数据保存、失败事务回滚、缺失密钥提示。
没有访问你的真实密钥或Supabase数据，没有调用真实Groq。本次确认的是会在调用前拦截的代码缺陷；截图0调用是否完全由它导致，需要部署后实测。未配置变量或数据库异常仍会阻止API调用。
不会自动重新生成所有历史故事，只在你点击按钮时调用。失败调用也可能消耗服务商额度；本包不自动重试。
原有story_group_items的用户-单词唯一约束保留；重复故事的完整目标词存入新故事memory_tip的带版本JSON中，并在读取接口解析，不需要迁移表。旧版客户端直接读新记录可能看到JSON，因此回退时需注意。
仍为个人Demo：按账号限额不能防止新建多个账号消耗共享额度，保持Groq免费套餐并按其Limits页面使用。
