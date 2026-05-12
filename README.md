# Cloud-Vault

Cloud-Vault is a Cloudflare-first bookkeeping application. The first build includes a Vue 3 web client and a Hono Worker API backed by Cloudflare D1 and KV.

## Structure

```text
frontend/  Vue 3 + TypeScript + Vite client
worker/    Cloudflare Worker API, D1 migration, KV sessions
项目分析文档/  product, API, database and frontend analysis
```

## Local Setup

```bash
npm install
npm run typecheck
npm run build
```

Run the two apps separately during development:

```bash
npm run dev:worker
npm run dev:frontend
```

Before using a real Cloudflare environment, update `worker/wrangler.toml` bindings and secrets, then apply the D1 migration in `worker/migrations/0001_init.sql`.

## First Run

1. Start the Worker API:

   ```bash
   npm run dev:worker
   ```

2. Initialize D1 and the first administrator invite:

   ```bash
   curl http://127.0.0.1:8787/api/init/change-this-jwt-secret
   ```

3. Start the web client:

   ```bash
   npm run dev:frontend
   ```

4. Register with `admin@example.com` and `change-this-invite-code`, then sign in.
