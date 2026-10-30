# v3.1.1：从当前Groq页面到故事生成

本包是完整源码，可直接覆盖 Web-APP。包含前版全部修复，无需先装3.1.0。

## A. 创建Groq密钥
1. 点击你截图右上方“API 密钥”（API Keys），也可访问 https://console.groq.com/keys 。
2. 点击 Create API Key，名称填 IELTS-Story；若要求选有效期，按个人需要选择，过期后要更新Vercel密钥。
3. 复制生成的Key，只保存到自己的密码管理器或Vercel。不要提交GitHub、不要发聊天截图。
4. 在账户Billing/套餐页确认仍为Free Plan，不开通Developer付费计划。免费额度不是无限量，以账户Limits页面为准。

## B. 上传源码
1. GitHub Desktop选择 Web-APP，Fetch/Pull origin。已有修改先保存，备份项目文件夹。
2. Repository → Show in Explorer。
3. 解压本包，进入 Web-APP-v3.1.1-Groq。将里面全部文件和文件夹复制到现有仓库根目录，替换同名项；保留 .git、.env.local。不要复制外层文件夹形成嵌套。
4. 预期根目录直接出现 package.json、app、lib、public、scripts。
5. GitHub Desktop取消勾选 .idea 编辑器配置；不上传 .env.local、真实Key、node_modules、.next。本包.env.example只有空密钥和示例配置，可以上传。
6. Summary填 Add Groq AI stories v3.1.1，点击Commit to main，再Push origin。

## C. Vercel配置：三个变量
进入现有 web-app 项目，左侧 Environment Variables，新增或编辑同名变量；选择Production，要测预览再选Preview。

|Key|Value|
|---|---|
|STORY_API_KEY|刚才复制的Groq真实密钥|
|STORY_MODEL|openai/gpt-oss-20b|
|STORY_API_BASE_URL|https://api.groq.com/openai/v1|

Value不要带引号或空格。不要把openai/gpt-oss-20b翻译成中文显示名，也不要使用安全审核/语音模型。这个模型运行在Groq，Key也必须来自Groq，不需要另建OpenAI账号。
基础地址不要追加/chat/completions，程序会追加。
原DATABASE_URL、AUTH_SECRET、PIN_PEPPER、ADMIN_PIN保留，恢复Supabase项目后先确认原账号可登录。
保存变量后进入Deployments，找到本次提交，菜单 → Redeploy，等待Ready；变量只对新部署生效。

## D. 测试
1. Ctrl+F5刷新 https://web-app-rho-opal.vercel.app ，应看到v3.1.1。
2. 用原账号登录；至少需要5个已学且未用于旧故事的词。
3. 进入“故事”，点击生成，等待，最长API等待约45秒。不要重复点击。
4. 应出现中英标题、中文故事和可展开的英文故事。保存后刷新仍可查看，读取不会再次调用模型。
5. 在Groq Dashboard/Usage确认调用记录和消耗。网站和Groq可能需刷新后才显示最新记录。

## E. 当前实现
默认最多10词；每个账号滚动24小时最多成功保存10组；同账号不能并发生成。接口返回JSON，程序检查5个必填字段和全部目标词出现，再用数据库事务保存。错误时不会用模板冒充AI。
Groq调用设置JSON输出、最多3000个completion tokens、GPT-OSS低推理强度；不自动重试，避免放大消耗。模型的语义、翻译准确性还需学习时核对。
免费限额由Groq组织共享，不同账号不是独立免费额度。本应用按账号限额不能防止多账号使用，个人Demo先保留免费套餐，公开推广前再增加全站限制。

## F. 报错处理
- 尚未配置：变量名必须精确，检查Production作用域并Redeploy。
- 认证失败：Key是否完整/过期，是否允许此模型。
- 模型不可用：先在Groq Playground确认账户能选openai/gpt-oss-20b，或复制自己可用的文本模型ID到STORY_MODEL再部署。
- 429：免费额度/频率限制，等待恢复并检查Limits；不要连续点击。
- 超时：稍后重试，核对地址。
- 故事格式或目标词校验失败：重试一次；持续失败发错误提示，Key保持隐藏。
- 至少5个词：先学习更多；已用于旧故事的词不会自动重复选择。
- 服务不可用：先检查Supabase已恢复，再看Vercel Runtime Logs，不要把它误判为Groq问题。

## G. 其他兼容服务
同样只改STORY_API_KEY、STORY_MODEL、STORY_API_BASE_URL三个变量并重新部署。必须支持Chat Completions的messages输入和choices.message.content输出；基础地址必须HTTPS。Groq专用参数只在api.groq.com主机启用。不同平台免费政策需另行核对。

## H. 验证范围
已通过生产构建/TypeScript检查及模拟Groq请求验证。没有你的Key，未进行真实Groq付费或免费额度调用，也未完成恢复后数据库端到端验收。包不包含数据库数据，不需要重新执行建表SQL。
官方参考：
https://console.groq.com/docs/openai
https://console.groq.com/docs/model/openai/gpt-oss-20b
https://console.groq.com/docs/rate-limits
