# IELTS Vocabulary Web App v2.0.1 SSL Hotfix

这是 v2.0.1 SSL 修复版。

## 修复的问题

登录时报错：

```text
self-signed certificate in certificate chain
```

原因是 Vercel 的 Node.js 运行环境连接 Supabase PostgreSQL pooler 时，`DATABASE_URL` 里的 `sslmode=require` 可能覆盖代码里的 SSL 设置，导致证书链校验失败。

本版本在 `lib/db.ts` 中修复：

- 自动把 `postgresql+psycopg2://` 转成 Node 可用的 `postgresql://`；
- 自动移除 URL 里的 `sslmode=require`；
- 手动设置 `ssl: { rejectUnauthorized: false }`；
- 保持 Supabase 云端 SSL 连接可用。

## 部署方式

1. 解压本 ZIP；
2. 覆盖 GitHub 仓库根目录；
3. Commit；
4. Push；
5. Vercel 会自动重新部署。

## Vercel 环境变量保持不变

不用改环境变量，继续保留：

```env
DATABASE_URL=postgresql+psycopg2://...
AUTH_SECRET=...
PIN_PEPPER=ielts-vocabulary-app-v1.2
ADMIN_PIN=...
NODE_ENV=production
```

注意：`DATABASE_URL` 仍然可以保留 `?sslmode=require`，代码会自动处理。
