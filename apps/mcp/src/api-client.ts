import { API_URL } from './config.js';

/**
 * Thin typed client over the vookapix REST API. Every instance is bound to a
 * single user's personal API token (forwarded from the MCP request), so all
 * calls run as that user and consume their credits.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class VookapixClient {
  constructor(private readonly token: string) {}

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { query?: Record<string, unknown>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(`${API_URL}${path}`);
    if (opts.query) {
      for (const [key, value] of Object.entries(opts.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = { ...this.authHeaders() };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    const data = text ? safeJson(text) : undefined;

    if (!res.ok) {
      const message =
        (data && (data.message || data.error)) || text || res.statusText;
      throw new ApiError(
        Array.isArray(message) ? message.join(', ') : String(message),
        res.status,
      );
    }
    return data as T;
  }

  getMe() {
    return this.request<{
      id: string;
      email: string;
      credits: number;
      role: string;
    }>('GET', '/auth/me');
  }

  getCredits() {
    return this.request<{ credits: number }>('GET', '/credits');
  }

  listModels(type?: string) {
    return this.request<unknown[]>('GET', '/generations/models', {
      query: { type },
    });
  }

  getCost(query: Record<string, unknown>) {
    return this.request<{ credits: number }>('GET', '/generations/cost', {
      query,
    });
  }

  createGeneration(body: Record<string, unknown>) {
    return this.request<Generation>('POST', '/generations/create', { body });
  }

  getGeneration(id: string) {
    return this.request<Generation>('GET', `/generations/${id}`);
  }

  async listGenerations(query: Record<string, unknown>) {
    const me = await this.getMe();
    return this.request<{ items: Generation[]; total: number }>(
      'GET',
      `/generations/user/${me.id}`,
      { query },
    );
  }

  /**
   * Downloads an image from a URL and uploads it as a reference image, returning
   * the stored URL that can be passed to create_image / create_video.
   */
  async uploadReferenceFromUrl(url: string): Promise<{ url: string }> {
    const download = await fetch(url);
    if (!download.ok) {
      throw new ApiError(
        `Failed to download reference image (${download.status})`,
        download.status,
      );
    }
    const contentType =
      download.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      throw new ApiError('Reference URL is not an image', 400);
    }
    const buffer = Buffer.from(await download.arrayBuffer());
    const ext = contentType.split('/')[1]?.split(';')[0] || 'png';

    const form = new FormData();
    form.append(
      'file',
      new Blob([buffer], { type: contentType }),
      `reference.${ext}`,
    );

    const res = await fetch(`${API_URL}/generations/upload-reference`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: form,
    });
    const text = await res.text();
    const data = text ? safeJson(text) : undefined;
    if (!res.ok) {
      const message = (data && (data.message || data.error)) || res.statusText;
      throw new ApiError(String(message), res.status);
    }
    return data as { url: string };
  }
}

export interface Generation {
  id: string;
  status: 'pending' | 'processing' | 'done' | 'failed' | 'cancelled';
  type: string;
  model: string;
  provider: string;
  prompt: string;
  resultUrl?: string | null;
  errorMessage?: string | null;
  creditCost: number;
  durationSeconds?: number | null;
  generateAudio?: boolean | null;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
