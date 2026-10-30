# v3.0.2 完整更新与部署指南

适用仓库：https://github.com/yl20021008-blip/Web-APP
线上地址：https://web-app-rho-opal.vercel.app
不要覆盖 APP-demo：它是另一个 Streamlit 项目。

## 1. 本包是什么
完整 Next.js 源码，不是仅含改动的补丁。包含 app、lib、public、scripts、package.json、package-lock.json 和配置文件。未包含 node_modules、.next、.git、真实密码和数据库数据。数据库继续使用原 Supabase 项目。
修复：数据库故障不再被七个读取接口误报为未登录；登录先校验输入；今日总结使用当前账号服务端记录；异常响应提示；故事模板描述；主题色配置。没有新增录音评分或大模型故事服务。
当前线上有效格式登录已复现 tenant/user not found；此包不能自动修复平台连接配置。其他模块尚未完成连接真实数据库的端到端验收。今日统计仍沿用数据库日期边界；跨时区统一另行优化。

## 2. 先备份与整理
1. 打开 GitHub Desktop，选中 Web-APP；Repository → View on GitHub，确认地址。
2. Fetch origin，再 Pull origin。若有未提交修改，先保存提交或单独备份，避免覆盖。
3. Repository → Show in Explorer。备份当前整个文件夹到别处，并记下当前提交号。
4. 解压更新包，进入 Web-APP-v3.0.2 文件夹。这里应直接看见 package.json、app、lib。
5. 把该文件夹里面的全部内容复制到现有 Web-APP 仓库根目录，选择替换同名文件。Windows 可开启“显示隐藏的项目”，一并复制 .gitignore 和 .env.example。
6. 保留原仓库 .git 和本机 .env.local。不要把整个 Web-APP-v3.0.2 外层文件夹嵌套上传。
7. 本次无需删除原来的额外文件。不要上传 .env.local、密码、node_modules 或 .next。

## 3. 修复 Supabase 连接（先做，再部署）
1. 登录 Supabase，选原来的项目，确认项目运行中；若暂停，先恢复并等待就绪。
2. 在 Table Editor 确认原 users、words、learning_status 等表还在。已有数据库不要重新执行 scripts/setup-supabase.sql，也不要新建项目代替原数据库。
3. 点击项目 Connect，取得当前项目的连接字符串。面向 Vercel serverless 优先选 Transaction pooler；以页面给出的主机、端口和用户名为准，不手写区域或 aws-0/aws-1。
4. 保留完整 postgres.<项目标识> 用户名；将密码占位符换成真实数据库密码。密码内 @、#、:、/、% 等字符需要按 URL 密码组件编码；不要编码整个连接字符串。这不是 Supabase API key，也不是网站登录 PIN。
5. tenant/user not found 表示 pooler 未匹配到主机与用户名对应的项目，不等同于普通 DNS 故障。若完全照 Connect 复制仍失败，进一步检查项目状态或联系 Supabase 支持，不要反复猜连接地址。

## 4. Vercel 环境变量
进入现有 web-app 项目 → Settings → Environment Variables。至少对 Production 生效；若要测预览，另选 Preview。

|名称|处理|
|---|---|
|DATABASE_URL|替换为上一步正确的 PostgreSQL 连接字符串|
|AUTH_SECRET|已有有效值则保留；缺失时生成长随机值，不能使用模板占位符|
|PIN_PEPPER|已有值必须保留，改动会导致原账号 PIN 无法验证；原来未设置可继续不设置|
|ADMIN_PIN|保留原管理员 PIN；管理概览使用|

不要加 NEXT_PUBLIC_ 前缀，不要把变量值提交 GitHub。AUTH_SECRET 更换后旧会话失效，需要重新登录。可在安装 Node.js 的本机终端运行 node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 生成新密钥。环境变量保存后必须重新部署才生效。

## 5. 上传 GitHub
推荐 GitHub Desktop：检查 Changes，确认是源码和文档，不含密码；Summary 填 Fix deployment diagnostics and daily summary v3.0.2；Commit to main；Push origin。
如果只用网页：进入 Web-APP 根目录 → Add file → Upload files，把解压文件夹内的文件和子目录拖入，提交。保留目录层级，确认 app/page.tsx 等是覆盖而不是新增嵌套路径。Desktop 更稳妥。

## 6. 部署 Vercel
使用现有项目以保留原网址。Settings → Git 检查绑定 yl20021008-blip/Web-APP、生产分支 main。
Framework Preset：Next.js；Root Directory：仓库根目录（package.json 所在位置）；Build Command：npm run build；Install Command 可设 npm ci；Output Directory 使用 Next.js 默认值，不填 out。
Push 后查看 Deployments，确认部署对应刚才的提交，等待 Ready。若仅修改环境变量或没有自动触发，可在部署菜单选择 Redeploy。
本包包含依赖锁文件，构建用 npm ci 可复现依赖版本。

## 7. 上线验收
1. 浏览器强制刷新，标题版本应为 v3.0.2。
2. 用原账号登录，确认词库和历史进度仍在。
3. 查看首页、新词、复习、薄弱词、章节、词库搜索与分页。
4. 对一个词提交一次学习结果，刷新，检查状态和今日总结保存成功；这会真实改变该账号学习记录。
5. 故事需要至少五个符合条件、尚未用于故事的已学词；不足时出现提示是正常的。口语当前是任务卡，不是录音评分。
6. 退出并再次登录，确认会话流程。
若首页正常但登录提示服务不可用：检查 Vercel Runtime Logs 与数据库配置；若部署 Error：看 Build Logs 第一条实际错误。分享截图时遮住密码和完整连接字符串。

## 8. 回退
记录新旧提交号。GitHub Desktop 对本次提交使用 Revert changes in commit，再推送，或使用 Vercel 的上一成功部署回退功能。代码回退不能自动修正 DATABASE_URL，也不会恢复已写入数据库的数据。

官方参考：
https://supabase.com/kb/troubleshooting/tenant-or-user-not-found
https://supabase.com/docs/guides/database/connecting-to-postgres
https://vercel.com/docs/environment-variables
https://vercel.com/docs/git
