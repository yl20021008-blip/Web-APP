# v3.1.0 AI故事接入：只需配置三个变量

## 第一步：准备模型服务
选择你能正常开通、支持 OpenAI Chat Completions 格式的模型服务商。在其开发者控制台创建 API Key，并查到 Base URL 和模型 ID。不是所有服务都兼容；本版使用 POST /chat/completions、messages 输入和 choices[0].message.content 输出。
OpenAI 官方接口文档：https://developers.openai.com/api/reference/resources/chat
本包未附 API Key。不要把密钥发聊天或提交 GitHub。外部请求只发送目标词和释义，不发送账号、PIN、学习日志。模型调用可能计费，失败或校验未通过的请求也可能收费。

## 第二步：更新代码
沿用 UPDATE_GUIDE_中文.md 的覆盖方法，选择 Web-APP 仓库；把本包外层文件夹里面的全部内容覆盖到仓库根目录，保留 .git 和 .env.local。
在 GitHub Desktop 排除 .idea 文件，Summary 填 Add AI memory stories v3.1.0，再 Commit 和 Push origin。
旧故事和学习数据继续保留，无需执行建表SQL或改数据库结构。

## 第三步：Vercel填写环境变量
进入现有 web-app 项目 → Environment Variables，添加下表变量并应用到 Production（要测试预览再加 Preview）。

|变量名|填什么|
|---|---|
|STORY_API_KEY|服务商生成的真实 API Key|
|STORY_MODEL|服务商支持的具体模型 ID，按其控制台原样填|
|STORY_API_BASE_URL|服务商文档给出的 OpenAI兼容 Base URL，通常以 /v1 结尾|

注意：Base URL 不包含 /chat/completions，程序会自动追加。不要随意给服务商地址加 /v1；以其文档为准。必须 HTTPS。若使用 OpenAI 官方服务，可填 https://api.openai.com/v1；模型使用自己账号有权限、支持 Chat Completions 的文本模型。没有写死模型默认值。
不要加 NEXT_PUBLIC_ 前缀。原 DATABASE_URL、AUTH_SECRET、PIN_PEPPER、ADMIN_PIN 保持原值。
变量填好后，在 Deployments 对最新版点击 Redeploy，等待 Ready。变量只会应用到新部署。

## 第四步：验证
网站刷新后应显示 v3.1.0。先确认 Supabase 已恢复并能登录，再在故事页点击生成。
每组最多10词，至少需要5个未用于旧故事的已学词；按较早学习优先。生成等待可能长达45秒。每账号滚动24小时最多成功保存10组；同账号同时只允许一次生成。
成功会保存到数据库，之后查看不再调用API。英语和中文故事在原故事页查看。

常见提示：
- 尚未配置故事服务：变量没填或没有重新部署。
- 认证失败：核对服务商 Key、模型ID及权限。
- 额度不足/请求频繁：查看服务商余额和速率限制。
- 超时/连接失败：核对 Base URL、服务可用性，稍后重试。
- 返回格式不正确/未覆盖全部词：模型没有按要求输出；重试或换一个更擅长指令遵循的模型。不会静默用模板冒充AI。
- 已学词不足：先学习更多词，旧模板故事占用的词不会自动重复入选。

## 验证范围与限制
生产构建、TypeScript 检查、模拟API响应与词汇校验已测试；未使用真实付费 Key，未完成真实服务商/数据库端到端验收。自动检查保证必填字段和目标词出现，不能保证翻译和词义完全准确，需要学习时自行核对。未实现全站费用上限；公开自动注册可创建多账号，因此公开推广前应在服务商侧设置预算/额度限制，并进一步增加全站限额。当前发布适合个人Demo。
遇到生成服务问题可回退上一部署；历史数据不会因代码回退自动撤销。
