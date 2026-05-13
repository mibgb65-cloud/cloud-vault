# Cloudflare Dashboard 部署教程

本项目已调整为单个 Cloudflare Worker 部署：Worker 负责 `/api/*` 接口，前端静态文件由 Worker Assets 托管。你只需要在 Cloudflare 面板里配置，不需要修改代码里的 ID 或密钥。

## 1. 导入仓库

1. 将本仓库推送到你的 GitHub / GitLab。
2. 打开 Cloudflare Dashboard。
3. 进入 **Workers & Pages**。
4. 点击 **Create application**。
5. 选择 **Import a repository**，授权并选择你的仓库。
6. 项目名称建议填写：`cloud-vault`。

## 2. 构建设置

在 Cloudflare 的构建配置中填写：

| 配置项 | 值 |
| --- | --- |
| Root directory | `.` |
| Build command | `npm ci && npm run build` |
| Deploy command | `npx wrangler deploy --cwd worker` |

`worker/wrangler.toml` 已经声明了前端 Assets、D1 和 KV 绑定。Cloudflare 会在部署时根据配置创建或绑定这些资源，不需要你在代码里填写资源 ID。

## 3. 配置变量和密钥

进入 Worker 的 **Settings -> Variables and Secrets**。

添加以下运行时变量或密钥，名称必须完全一致：

| 名称 | 建议类型 | 示例 |
| --- | --- | --- |
| `admin_email` | Variable | `admin@example.com` |
| `registration_invite_code` | Secret | 自己生成的一串邀请码 |
| `jwt_secret` | Secret | 随机长字符串 |
| `invite_hash_secret` | Secret | 另一串随机长字符串 |

可选变量：

| 名称 | 建议类型 | 默认值 |
| --- | --- | --- |
| `registration_mode` | Variable | `invite_only` |
| `default_currency` | Variable | `CNY` |
| `default_locale` | Variable | `zh-CN` |
| `deepseek_model` | Variable | `deepseek-chat` |
| `deepseek_api_key` | Secret | DeepSeek API Key |

`registration_invite_code` 是第一个管理员注册时使用的邀请码。`jwt_secret` 之后初始化时也会用到。

## 4. 确认 D1 数据库

部署后进入 Worker 的 **Settings -> Bindings**，确认存在 D1 绑定：

| 类型 | 变量名 | 名称 |
| --- | --- | --- |
| D1 database | `DB` | `cloud-vault` |

数据库表会在首次初始化接口调用时自动创建。

## 5. 确认 KV 命名空间

仍在 **Settings -> Bindings**，确认存在 KV 绑定：

| 类型 | 变量名 |
| --- | --- |
| KV namespace | `SESSION_KV` |

KV 用于保存登录会话。

## 6. 重新部署

完成变量和密钥后，进入 **Deployments** 页面，点击最新部署的 **Retry deployment**，确保新变量进入当前版本。

部署成功后，你会得到一个 Worker 地址，例如：

```text
https://cloud-vault.<your-subdomain>.workers.dev
```

## 7. 初始化应用

打开浏览器访问：

```text
https://你的地址/api/init/你的-jwt_secret
```

成功时会返回初始化成功的 JSON。

然后打开 Worker 首页：

```text
https://你的地址
```

使用下面的信息注册第一个管理员：

| 字段 | 使用值 |
| --- | --- |
| 邮箱 | `admin_email` |
| 邀请码 | `registration_invite_code` |

## 8. 绑定自定义域名

进入 Worker 的 **Settings -> Domains and Routes**，添加自定义域名即可。由于前端和 API 已经同域部署，不需要额外配置跨域或前端 API 地址。

## 常见问题

`/api/init/...` 返回 403：检查 URL 里的密钥是否和 `jwt_secret` 完全一致。

接口提示 D1 未绑定或数据库错误：检查 D1 绑定变量名必须是 `DB`。

登录后很快失效或会话错误：检查 KV 绑定变量名必须是 `SESSION_KV`。

打开页面正常但接口返回前端 HTML：确认当前部署使用的是仓库里的 `worker/wrangler.toml`，其中 `run_worker_first = true`。
