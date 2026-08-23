# vookapix MCP server

Remote [MCP](https://modelcontextprotocol.io) server that lets Claude (and any
other MCP client) create images and videos, check credits and browse
generations on a user's vookapix account — driven entirely by natural language.

Every action runs through the normal vookapix API, so credits are deducted and
prompt moderation applies exactly as in the web app. Nothing bypasses billing.

## How it works

```
Claude ──Bearer vpx_token──▶ MCP server (/mcp) ──Bearer vpx_token──▶ vookapix API
```

- The user creates a personal API token in the vookapix dashboard.
- They add this MCP server's URL + token to their MCP client.
- The MCP server is **stateless**: each request is authenticated by the token in
  its `Authorization` header and runs as that user.

## Tools

| Tool | Description |
|------|-------------|
| `check_credits` | Current credit balance |
| `list_models` | Available models and their supported sizes/qualities/resolutions |
| `estimate_cost` | Credits a generation will cost before running it |
| `create_image` | Generate an image (waits for the result by default) |
| `create_video` | Generate a video (waits for the result by default) |
| `get_generation` | Poll one generation by id |
| `list_generations` | List recent generations |
| `upload_reference_from_url` | Store a reference image from a URL |

## Run locally

```bash
# from the repo root (installs all workspaces)
npm install

# start the API first (port 3001), then:
npm run dev:mcp
```

Environment variables (all optional in dev):

| Variable | Default | Description |
|----------|---------|-------------|
| `VOOKAPIX_API_URL` | `http://localhost:3001` | Base URL of the NestJS API |
| `MCP_PORT` | `3002` | Port for this server (endpoint is `/mcp`) |
| `MCP_GENERATION_TIMEOUT_MS` | `480000` | Max wait for a generation to finish |
| `MCP_GENERATION_POLL_INTERVAL_MS` | `4000` | Poll interval while waiting |

## Connect from Claude

In Claude, add a custom connector / MCP server:

- **URL**: `https://<your-mcp-host>/mcp` (or `http://localhost:3002/mcp` in dev)
- **Authorization header**: `Bearer vpx_...` (the token from your dashboard)

Then ask, for example: *"Create a 5-second 16:9 video of a sunrise over the sea."*
