# Cloud-Vault

Cloud-Vault 是一个部署在 Cloudflare 上的轻量级记账应用。项目包含 Vue 3 前端、Hono Worker API、Cloudflare D1 数据库和 KV 会话存储，适合部署为一个单独的 Cloudflare Worker。

当前部署方式已经调整为和 SkyMail 类似的模式：前端静态资源由 Worker Assets 托管，后端接口走同一个 Worker 的 `/api/*` 路径。部署时不需要在代码里手动填写 D1/KV 资源 ID，只需要在 Cloudflare 面板配置变量、密钥和绑定。

## 功能概览

- 多账本管理
- 账户、分类、标签管理
- 收入、支出、转账记录
- 预算管理和报表统计
- 邀请码注册和管理员后台
- 深色/浅色主题
- PWA 基础支持
- 可选 DeepSeek AI 自然语言记账

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | Vue 3, TypeScript, Vite, Pinia, Vue Router, Tailwind CSS |
| 后端 | Cloudflare Workers, Hono, TypeScript |
| 数据库 | Cloudflare D1 |
| 会话 | Cloudflare KV |
| 图表 | ECharts |
| 校验 | Zod |

## 项目结构

```text
frontend/        Vue 3 + Vite 前端
worker/          Cloudflare Worker API 和部署配置
worker/migrations/ D1 数据库迁移
docs/            部署文档
tests/           Playwright 视觉测试
项目分析文档/      产品、接口、数据库和前端方案文档
```

## Cloudflare 面板部署

推荐使用 Cloudflare Dashboard 导入仓库部署，不需要本地执行部署命令。

详细步骤见：[Cloudflare Dashboard 部署教程](docs/cloudflare-dashboard-deploy.md)

核心配置如下：

| 配置项 | 值 |
| --- | --- |
| Root directory | `.` |
| Build command | `npm ci && npm run build` |
| Deploy command | `npx wrangler deploy --cwd worker` |

部署后在 Cloudflare Worker 的 **Variables and Secrets** 中配置：

| 名称 | 类型建议 | 说明 |
| --- | --- | --- |
| `admin_email` | Variable | 第一个管理员邮箱 |
| `registration_invite_code` | Secret | 第一个管理员注册邀请码 |
| `jwt_secret` | Secret | 登录令牌密钥，也是初始化接口密钥 |
| `invite_hash_secret` | Secret | 邀请码哈希密钥 |

可选配置：

| 名称 | 默认值 | 说明 |
| --- | --- | --- |
| `registration_mode` | `invite_only` | 注册模式 |
| `default_currency` | `CNY` | 默认货币 |
| `default_locale` | `zh-CN` | 默认语言 |
| `deepseek_model` | `deepseek-chat` | DeepSeek 模型 |
| `deepseek_api_key` | 空 | 启用 AI 记账时填写 |

`worker/wrangler.toml` 已声明以下绑定：

| 绑定名 | 类型 | 用途 |
| --- | --- | --- |
| `DB` | D1 database | 业务数据库 |
| `SESSION_KV` | KV namespace | 登录会话 |
| `ASSETS` | Worker Assets | 前端静态资源 |

## 首次初始化

部署成功后访问：

```text
https://你的域名/api/init/你的-jwt_secret
```

初始化成功后，打开站点首页，使用以下信息注册第一个管理员：

| 字段 | 值 |
| --- | --- |
| 邮箱 | `admin_email` |
| 邀请码 | `registration_invite_code` |

## 本地开发

环境要求：

- Node.js 20 或更高版本
- npm

安装依赖：

```bash
npm install
```

启动 Worker API：

```bash
npm run dev:worker
```

启动前端：

```bash
npm run dev:frontend
```

前端开发服务器默认代理 `/api` 到 `http://127.0.0.1:8787`。

## 构建和检查

```bash
npm run build
npm run typecheck
```

本地验证 Worker 打包配置：

```bash
npm --workspace worker run deploy -- --dry-run
```

## 生产部署说明

生产环境使用单 Worker 部署：

- `/api/*` 请求由 Hono API 处理
- 其它路径由 Worker Assets 返回 Vue 前端
- 前后端同域，不需要单独配置 `VITE_API_BASE_URL`
- D1 表结构会在首次调用 `/api/init/:secret` 时自动创建

## 安全建议

- 不要使用默认示例密钥
- `jwt_secret` 和 `invite_hash_secret` 使用不同的随机长字符串
- 首次管理员注册完成后，及时在后台调整注册和邀请码策略
- 如开启 AI 记账，将 `deepseek_api_key` 配置为 Secret
- 登录、注册和初始化接口已启用基于 KV 的基础限流：登录 20 次/10 分钟/IP，登录失败 5 次/10 分钟/IP+邮箱，注册 10 次/10 分钟/IP，初始化 5 次/10 分钟/IP

## 许可证

当前仓库未声明许可证。如需公开分发，请先补充明确的 LICENSE 文件。
