import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiError, Generation, VookapixClient } from './api-client.js';
import {
  GENERATION_POLL_INTERVAL_MS,
  GENERATION_WAIT_TIMEOUT_MS,
} from './config.js';

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

const ok = (data: unknown): ToolResult => ({
  content: [
    {
      type: 'text',
      text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
    },
  ],
});

const fail = (message: string): ToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
});

/** Wraps a tool handler so API errors become clean text for the model. */
async function run(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(`vookapix API error (${err.status}): ${err.message}`);
    }
    return fail(`Unexpected error: ${(err as Error).message}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Polls a generation until it reaches a terminal state or the timeout elapses.
 * Returns the last-seen generation either way so the caller can report a
 * still-pending job for later polling via get_generation.
 */
async function waitForGeneration(
  client: VookapixClient,
  id: string,
): Promise<Generation> {
  const deadline = Date.now() + GENERATION_WAIT_TIMEOUT_MS;
  let gen = await client.getGeneration(id);
  while (
    gen.status !== 'done' &&
    gen.status !== 'failed' &&
    gen.status !== 'cancelled' &&
    Date.now() < deadline
  ) {
    await sleep(GENERATION_POLL_INTERVAL_MS);
    gen = await client.getGeneration(id);
  }
  return gen;
}

function summarizeGeneration(gen: Generation) {
  return {
    id: gen.id,
    status: gen.status,
    type: gen.type,
    model: gen.model,
    provider: gen.provider,
    creditCost: gen.creditCost,
    resultUrl: gen.resultUrl ?? null,
    errorMessage: gen.errorMessage ?? null,
  };
}

/**
 * Builds an MCP server whose tools all act as the user identified by `token`.
 * A fresh server is created per request (stateless transport) so each request
 * carries its own personal API token.
 */
export function buildServer(token: string): McpServer {
  const client = new VookapixClient(token);
  const server = new McpServer({
    name: 'vookapix',
    version: '1.0.0',
  });

  server.tool(
    'check_credits',
    'Get the current credit balance for the connected vookapix account.',
    {},
    () => run(async () => ok(await client.getCredits())),
  );

  server.tool(
    'list_models',
    'List the available AI models with the sizes, qualities and resolutions each one supports. Call this before creating to pick a valid model and provider.',
    {
      type: z
        .enum(['image', 'video'])
        .optional()
        .describe('Filter models by generation type.'),
    },
    ({ type }) => run(async () => ok(await client.listModels(type))),
  );

  server.tool(
    'estimate_cost',
    'Estimate how many credits a generation will cost before creating it.',
    {
      provider: z.string().describe('AI provider id, e.g. "google", "fal".'),
      model: z.string().describe('Model id from list_models.'),
      type: z.enum(['image', 'video']).default('image'),
      size: z.string().optional().describe('Aspect ratio, e.g. "1:1", "16:9".'),
      quality: z.string().optional(),
      resolution: z.string().optional(),
      hasReference: z.boolean().optional(),
      durationSeconds: z.number().int().optional(),
      generateAudio: z.boolean().optional(),
    },
    (args) => run(async () => ok(await client.getCost(args))),
  );

  const referenceImageUrls = z
    .array(z.string().url())
    .optional()
    .describe(
      'Stored reference image URLs (use upload_reference_from_url to create one).',
    );

  const waitParam = z
    .boolean()
    .default(true)
    .describe(
      'Wait for the generation to finish and return the result URL. If false, returns immediately with the pending job id.',
    );

  server.tool(
    'create_image',
    'Create an AI image. Deducts credits from the connected account. By default waits for the result and returns the image URL.',
    {
      prompt: z.string().min(3).max(2000),
      model: z.string().describe('Model id from list_models.'),
      provider: z.string().describe('Provider id from list_models.'),
      size: z.string().optional().describe('Aspect ratio, e.g. "1:1".'),
      quality: z.string().optional(),
      resolution: z.string().optional(),
      referenceImageUrls,
      wait: waitParam,
    },
    ({ wait, ...body }) =>
      run(async () => {
        const created = await client.createGeneration({
          ...body,
          type: 'image',
        });
        if (!wait) return ok(summarizeGeneration(created));
        const finished = await waitForGeneration(client, created.id);
        return ok(summarizeGeneration(finished));
      }),
  );

  server.tool(
    'create_video',
    'Create an AI video. Deducts credits from the connected account. Videos take longer; by default waits for the result and returns the video URL.',
    {
      prompt: z.string().min(3).max(2000),
      model: z.string().describe('Video model id from list_models.'),
      provider: z.string().describe('Provider id from list_models.'),
      size: z.string().optional().describe('Aspect ratio, e.g. "16:9".'),
      resolution: z.string().optional().describe('e.g. "720p", "1080p".'),
      durationSeconds: z
        .number()
        .int()
        .min(1)
        .max(60)
        .optional()
        .describe('Clip length in seconds (clamped to the model range).'),
      generateAudio: z
        .boolean()
        .optional()
        .describe('Generate native audio (only some models support this).'),
      referenceImageUrls,
      wait: waitParam,
    },
    ({ wait, ...body }) =>
      run(async () => {
        const created = await client.createGeneration({
          ...body,
          type: 'video',
        });
        if (!wait) return ok(summarizeGeneration(created));
        const finished = await waitForGeneration(client, created.id);
        return ok(summarizeGeneration(finished));
      }),
  );

  server.tool(
    'get_generation',
    'Get the status and result of a single generation by id (use this to poll a job created with wait=false).',
    {
      id: z.string().describe('Generation id returned by create_image/create_video.'),
    },
    ({ id }) =>
      run(async () => ok(summarizeGeneration(await client.getGeneration(id)))),
  );

  server.tool(
    'list_generations',
    'List the connected account\'s recent generations, newest first.',
    {
      type: z.enum(['image', 'video']).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    },
    (query) =>
      run(async () => {
        const { items, total } = await client.listGenerations(query);
        return ok({ total, items: items.map(summarizeGeneration) });
      }),
  );

  server.tool(
    'upload_reference_from_url',
    'Download an image from a public URL and store it as a reference image. Returns a URL to pass in referenceImageUrls when creating.',
    {
      url: z.string().url().describe('Public URL of the source image.'),
    },
    ({ url }) =>
      run(async () => ok(await client.uploadReferenceFromUrl(url))),
  );

  return server;
}
