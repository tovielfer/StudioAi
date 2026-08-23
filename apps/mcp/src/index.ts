import express, { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServer } from './server.js';
import { API_URL, PORT } from './config.js';

const app = express();
app.use(express.json({ limit: '4mb' }));

/** Extracts the personal API token (vpx_...) from the Authorization header. */
function extractToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return undefined;
}

function jsonRpcError(res: Response, status: number, message: string) {
  res.status(status).json({
    jsonrpc: '2.0',
    error: { code: -32000, message },
    id: null,
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, apiUrl: API_URL });
});

/**
 * MCP endpoint. Stateless: a fresh server + transport is created per request so
 * each request runs as the user identified by its own personal API token.
 */
app.post('/mcp', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    return jsonRpcError(
      res,
      401,
      'Missing personal API token. Set Authorization: Bearer vpx_... (create one in your vookapix dashboard).',
    );
  }

  const server = buildServer(token);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on('close', () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP request failed:', err);
    if (!res.headersSent) {
      jsonRpcError(res, 500, 'Internal server error');
    }
  }
});

// Stateless server: GET/DELETE sessions are not supported.
const methodNotAllowed = (_req: Request, res: Response) =>
  jsonRpcError(res, 405, 'Method not allowed.');
app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

app.listen(PORT, () => {
  console.log(`vookapix MCP server listening on http://localhost:${PORT}/mcp`);
  console.log(`Proxying to vookapix API at ${API_URL}`);
});
