/** Base URL of the vookapix NestJS API the MCP server proxies to. */
export const API_URL = (
  process.env.VOOKAPIX_API_URL || 'http://localhost:3001'
).replace(/\/$/, '');

/** Port the MCP HTTP server listens on. */
export const PORT = Number(process.env.MCP_PORT || 3002);

/**
 * How long create_* tools wait (ms) for a generation to finish before returning
 * the pending job so the caller can poll get_generation manually.
 */
export const GENERATION_WAIT_TIMEOUT_MS = Number(
  process.env.MCP_GENERATION_TIMEOUT_MS || 8 * 60 * 1000,
);

/** Interval (ms) between status polls while waiting for a generation. */
export const GENERATION_POLL_INTERVAL_MS = Number(
  process.env.MCP_GENERATION_POLL_INTERVAL_MS || 4000,
);
