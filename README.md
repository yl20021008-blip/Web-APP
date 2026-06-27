# IELTS Vocabulary Web App v2.0

这是从 Streamlit 原型迁移出来的 **Next.js Web App 学习端**。

## 这一版做了什么

这一版不再使用 Streamlit 页面作为普通用户学习端，而是改成：

```text
Next.js Web App
+
Next.js Route Handlers API
+
Supabase PostgreSQL
```

普通学习者可以使用：

- 登录 / 创建学习者；
- 首页学习指标；
- 今日学习；
- 提交复习结果；
- 复习计划；
- 学习统计；
- 我的词库；
- 故事记忆；
- 英式 / 美式浏览器朗读兜底。

## 仍然保留 Streamlit 后台

v2.0 Web App 是学习端。公共词库导入、词库重置、管理员维护，建议继续使用你已有的 Streamlit v1.5.1 后台。

这样最现实：

```text
普通用户：Web App
管理员：Streamlit 后台
数据库：同一个 Supabase
```

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

然后打开：

```text
http://localhost:3000
```

## Vercel 部署

1. 将本项目上传到 GitHub 仓库；
2. 打开 Vercel；
3. Add New Project；
4. Import Git Repository；
5. Framework Preset 选择 Next.js；
6. 添加环境变量；
7. Deploy。

## 必须配置的环境变量

```env
DATABASE_URL="postgresql+psycopg2://postgres.xxxxx:your-password@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
AUTH_SECRET="换成你自己的长随机字符串"
PIN_PEPPER="ielts-vocabulary-app-v1.2"
ADMIN_PIN="你的管理员PIN"
NODE_ENV="production"
```

注意：

- `DATABASE_URL` 可以直接复制你 Streamlit Secrets 里的；
- 如果是 `postgresql+psycopg2://`，代码会自动转换；
- `PIN_PEPPER` 不要改，否则旧学习者 PIN 会不兼容；
- `AUTH_SECRET` 不能用默认值。

## 数据库修复 SQL

如果部署后提示 `learning_status` 默认值问题，去 Supabase SQL Editor 跑：

```sql
scripts/setup-supabase.sql
```

## 项目入口

Vercel 不需要填写 `main_app/app.py`。

这是 Next.js 项目，Vercel 会自动识别：

```text
package.json
app/
```

## 和 Streamlit 版的关系

| 功能 | Streamlit v1.5.1 | Web App v2.0 |
|---|---|---|
| 普通用户学习 | 可用但较慢 | 推荐使用 |
| 今日学习 | 有 | 有 |
| 复习计划 | 有 | 有 |
| 故事记忆 | 有 | 有 |
| 学习统计 | 有 | 有 |
| 公共词库管理 | 推荐继续使用 | 暂不开放 |
| 词汇补全中心 | 推荐继续使用 | 暂不开放 |

## 重要提醒

第一版 Web App 是学习端，不是完整后台。这样能最快解决 Streamlit 页面切换慢的问题。
