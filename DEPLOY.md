# Deploying CaseFile

CaseFile runs as **one Node service**: the Express server ([server/index.js](server/index.js))
serves the built React app from `dist/` **and** the `/api` routes. Build once, run one process.

```bash
npm run build   # produces dist/
npm start       # serves dist/ + API on $PORT (default 8787)
```

## Environment variables

Set these on your host (never commit real values — `.env` is git-ignored).

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEBIUS_API_KEY` | for AI Agent & Enrich | Nebius Token Factory API key. Powers deep generative synthesis & IRAC legal memos. |
| `NEBIUS_MODEL` | no | Defaults to `deepseek-ai/DeepSeek-V4.1-Flash` for sub-12s response times. |
| `TYPESAFE_API_KEY` | recommended | TypeSafe AI API key (`jev-latest`). Sub-100ms intent routing & adversarial candidate triage. |
| `LLM_TIMEOUT_MS` | no | Millisecond timeout for LLM synthesis (default `90000`). |
| `COURTLISTENER_TOKEN` | no | Full opinion text from CourtListener's authenticated API. |
| `CASEFILE_ACCESS_PASSWORD` | recommended for pre-launch | Locks the API behind a shared password. Testers are prompted once. |
| `RATE_LIMIT_API` | no | Requests / 15 min / IP (default `120`). |
| `RATE_LIMIT_COSTLY` | no | Extract+Enrich calls / hour / IP (default `30`). |
| `TRUST_PROXY` | recommended behind a proxy | Trust `X-Forwarded-For` so rate limits key on the real client IP. Set to `1` on Render/Railway/Fly. |
| `MAX_DOWNLOAD_BYTES` | no | Hard ceiling on single court-download fetch (default `2000000` = 2 MB). |
| `DOWNLOAD_TIMEOUT_MS` | no | Timeout for court downloads in ms (default `10000`). |
| `MAX_DELIVER_BATCH` | no | Max records one `/api/deliver` call may fan out (default `25`). |
| `PORT` | no | Hosts inject this automatically (default `8787`). |

## ⚠️ Cost protection (read before going public)

Because **you** pay for the LLM token consumption on your server key, the `/api/enrich` and `/api/extract` endpoints
spend compute budget on every call. Two guards ship enabled:

- **Rate limiting** — per-IP caps on the costly endpoints (tune with the env vars above).
- **Access gate** — set `CASEFILE_ACCESS_PASSWORD` to keep the instance private until
  billing exists. Strongly recommended for the first deploy.

Do **not** expose this publicly without either a low `RATE_LIMIT_COSTLY` or the access
password, or a stranger can run up your Nebius token bill.

## Option A — Render (git-based, recommended)

1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com): **New → Web Service** → connect the repo.
3. Settings:
   - **Root Directory:** the folder containing this file (if the repo root is elsewhere).
   - **Build Command:** `npm ci --include=dev && npm run build`
   - **Start Command:** `npm start`
4. Add the environment variables from the table above.
   *(Note: `--include=dev` ensures Vite is installed even when `NODE_ENV=production` is set).*
5. Deploy. Render gives you an HTTPS URL and sets `PORT` for you.

## Option B — Docker (Railway, Fly.io, Cloud Run, any VPS)

A [Dockerfile](Dockerfile) is included (multi-stage: build then run).

```bash
docker build -t casefile .
docker run -p 8787:8787 \
  -e NEBIUS_API_KEY=your-key \
  -e CASEFILE_ACCESS_PASSWORD=choose-one \
  casefile
# open http://localhost:8787
```

Point Railway/Fly/Cloud Run at the Dockerfile and set the same env vars in their dashboard.

## After it's live

1. Verify `GET /api/health` returns `{"ok":true, "llmEnrichment":true, ...}`.
2. Confirm the access gate: an API call without the password returns `401`.
3. **Then build the paywall** — accounts + Stripe subscription — which replaces the
   shared password with real per-user billing and usage metering. See the roadmap below.

## Roadmap to a paid product

- [x] Deploy live (this doc)
- [ ] Accounts / auth
- [ ] Stripe subscription + customer portal
- [ ] Per-plan usage metering & limits (protects LLM margin)
- [ ] Database: cache CourtListener results, store users & saved work
- [ ] Confirm commercial use terms with Free Law Project (CourtListener)
