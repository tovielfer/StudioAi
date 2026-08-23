# AI Image & Video Studio Platform

MVP platform for AI image generation with Next.js frontend, NestJS backend, PostgreSQL, Redis/BullMQ queue, and multi-provider AI integration.

## Architecture

```
apps/
├── web/     Next.js 15 frontend
├── api/     NestJS backend + BullMQ worker
└── mcp/     Remote MCP server (lets Claude drive the studio via a token)
```

- **Frontend**: Landing, auth, dashboard, create, history, gallery
- **Backend**: JWT auth, credits, generations API, rate limiting, prompt moderation
- **Worker**: Redis queue processes AI jobs with retry + credit refund on failure
- **Storage**: Local filesystem (dev) or Cloudflare R2 (production)
- **AI Providers**: Replicate, Fal.ai, OpenAI, Stability AI (+ mock mode for dev)

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL + Redis)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start database & Redis
npm run docker:up

# 4. Start dev servers (API on :3001, Web on :3000)
npm run dev
```

Open http://localhost:3000 — register to get 25 free credits.

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret |
| `REPLICATE_API_TOKEN` | Replicate API key (optional) |
| `OPENAI_API_KEY` | OpenAI API key (optional) |
| `FAL_KEY` | Fal.ai API key (optional) |
| `STABILITY_API_KEY` | Stability AI key (optional) |

Without AI API keys, the system runs in **mock mode** (placeholder images).

## API Endpoints

### Auth
- `POST /auth/register` — Register (25 free credits)
- `POST /auth/login` — Login, returns JWT
- `GET /auth/api-token` — Personal API token status (JWT)
- `POST /auth/api-token` — Create/rotate personal API token, returned once (JWT)
- `DELETE /auth/api-token` — Revoke personal API token (JWT)

### Generations
- `POST /generations/create` — Create generation job
- `GET /generations/:id` — Poll job status
- `GET /generations/user/:userId` — User gallery
- `POST /generations/upload-reference` — Upload reference image

### Credits
- `GET /credits` — Get balance
- `POST /credits/add` — Admin add credits (requires `x-admin-secret` header)

## Credit Costs

| Action | Credits |
|--------|---------|
| Standard image | 5 |
| HD image | 10 |
| Reference image | +5 |
| Video | 50 |

## Job Flow

1. User submits prompt → credits deducted
2. Job queued in Redis (BullMQ)
3. Worker calls AI provider
4. Result saved to storage (local/R2)
5. DB updated → UI polls and shows result
6. On failure after retries → credits refunded

## MCP (connect Claude)

The `apps/mcp` server exposes the studio as MCP tools so Claude (and any MCP
client) can create images/videos on a user's behalf. Users generate a personal
API token in the dashboard (`/mcp`) and connect Claude to the MCP URL with an
`Authorization: Bearer vpx_...` header. Every action runs through the normal API,
so credits are deducted and prompt moderation applies. See
[apps/mcp/README.md](apps/mcp/README.md) for details and the tool list.

```bash
npm run dev:mcp   # starts the MCP server on :3002 (endpoint /mcp)
```

## Production Notes

- Set `STORAGE_TYPE=r2` and configure R2 credentials
- Change `JWT_SECRET` and `ADMIN_SECRET`
- Add Stripe integration for billing (phase 2)
- Enable `synchronize: false` in TypeORM and use migrations
