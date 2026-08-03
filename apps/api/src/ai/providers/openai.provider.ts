import { Logger } from '@nestjs/common';
import { AiProvider } from '../../common/constants';
import { GenerateImageParams, GenerateImageResult, ImageUsage } from '../ai.types';
import { BaseImageProvider } from './base.provider';

interface TokenPrices {
  textInput: number;
  imageInput: number;
  imageOutput: number;
}

interface OpenAIErrorPayload {
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
}

class OpenAIProviderError extends Error {
  constructor(
    message: string,
    readonly providerErrorRaw: string,
    readonly status?: number,
    readonly code?: string,
    readonly type?: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'OpenAIProviderError';
  }
}

interface OpenAIReferenceImage {
  blob: Blob;
  filename: string;
}

// OpenAI Standard pricing, USD per 1M tokens.
// (Batch API is 50% cheaper but is async/offline — not used for live generation.)
const OPENAI_TOKEN_PRICES: Record<string, TokenPrices> = {
  'gpt-image-1': { textInput: 5, imageInput: 10, imageOutput: 40 },
  'gpt-image-1-mini': { textInput: 2, imageInput: 2.5, imageOutput: 8 },
  'gpt-image-1.5': { textInput: 5, imageInput: 8, imageOutput: 32 },
  'gpt-image-2': { textInput: 5, imageInput: 8, imageOutput: 30 },
  'chatgpt-image-latest': { textInput: 5, imageInput: 8, imageOutput: 32 },
};

export class OpenAIProvider extends BaseImageProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private static readonly MAX_TRANSIENT_RETRIES = 2;
  private static readonly DEFAULT_RETRY_DELAY_MS = 2_000;
  private static readonly MAX_RETRY_DELAY_MS = 20_000;

  private estimateCostUsd(model: string, usage?: ImageUsage): number {
    if (!usage) return 0;

    const prices =
      OPENAI_TOKEN_PRICES[model] ?? OPENAI_TOKEN_PRICES['gpt-image-1'];

    const inputImageTokens = usage.input_tokens_details?.image_tokens ?? 0;
    const inputTextTokens =
      usage.input_tokens_details?.text_tokens ??
      Math.max((usage.input_tokens ?? 0) - inputImageTokens, 0);
    // For image generation the output is always image tokens.
    const outputImageTokens = usage.output_tokens ?? 0;

    return (
      (inputTextTokens * prices.textInput +
        inputImageTokens * prices.imageInput +
        outputImageTokens * prices.imageOutput) /
      1_000_000
    );
  }

  async generate(params: GenerateImageParams): Promise<GenerateImageResult> {
    const model = params.model ?? 'gpt-image-1';
    const size = this.mapSize(model, params.size, params.resolution);
    const quality = this.mapQuality(params.quality);
    const refs = this.resolveReferenceImages(params);

    this.logger.log(
      `OpenAI generate() — model=${model}, refs=${refs.length}, route=${refs.length > 0 ? 'EDIT' : 'CREATE'}, size=${size}, quality=${quality}, refUrls=${JSON.stringify(refs)}`,
    );

    if (refs.length > 0) {
      return this.edit(params, model, size, quality, refs);
    }
    return this.create(params, model, size, quality);
  }

  private async edit(
    params: GenerateImageParams,
    model: string,
    size: string,
    quality: string,
    refs: string[],
  ): Promise<GenerateImageResult> {
    const imageKey = refs.length > 1 ? 'image[]' : 'image';
    const images: OpenAIReferenceImage[] = [];
    for (const refUrl of refs) {
      const { blob, filename } = await this.fetchReferenceImage(refUrl);
      this.logger.log(
        `OpenAI edit() — appending ref as key="${imageKey}", filename="${filename}", blob.type="${blob.type}", blob.size=${blob.size} bytes (from ${refUrl})`,
      );
      images.push({ blob, filename });
    }

    this.logger.log(
      `OpenAI edit() — POST /images/edits model=${model}, size=${size}, quality=${quality}, images=${refs.length}`,
    );

    const key = this.config.get('OPENAI_API_KEY');
    const response = await this.fetchOpenAIWithRetry('images/edits', () => {
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', params.prompt);
      form.append('size', size);
      form.append('quality', quality);
      form.append('n', '1');
      for (const image of images) {
        form.append(imageKey, image.blob, image.filename);
      }

      return {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      };
    });

    const data = (await response.json()) as {
      data?: { url?: string; b64_json?: string }[];
      usage?: ImageUsage;
    };

    const cost = this.estimateCostUsd(model, data.usage);
    this.logger.log(
      `OpenAI edit (${model}) — input: ${data.usage?.input_tokens ?? 'N/A'}, output: ${data.usage?.output_tokens ?? 'N/A'}, cost: $${cost.toFixed(5)}`,
    );

    return this.parseImageResponse(data, cost);
  }

  private async create(
    params: GenerateImageParams,
    model: string,
    size: string,
    quality: string,
  ): Promise<GenerateImageResult> {
    const key = this.config.get('OPENAI_API_KEY');
    const response = await this.fetchOpenAIWithRetry('images/generations', () => ({
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: params.prompt, size, quality, n: 1 }),
    }));

    const data = (await response.json()) as {
      data?: { url?: string; b64_json?: string }[];
      usage?: ImageUsage;
    };

    const cost = this.estimateCostUsd(model, data.usage);
    this.logger.log(
      `OpenAI generate (${model}) — input: ${data.usage?.input_tokens ?? 'N/A'}, output: ${data.usage?.output_tokens ?? 'N/A'}, cost: $${cost.toFixed(5)}`,
    );

    return this.parseImageResponse(data, cost);
  }

  private parseImageResponse(
    data: {
      data?: { url?: string; b64_json?: string }[];
      usage?: ImageUsage;
    },
    costUsd: number,
  ): GenerateImageResult {
    const item = data.data?.[0];
    if (item?.url) {
      return {
        imageUrl: item.url,
        provider: AiProvider.OPENAI,
        usage: data.usage,
        costUsd,
      };
    }
    if (item?.b64_json) {
      return {
        imageUrl: `data:image/png;base64,${item.b64_json}`,
        provider: AiProvider.OPENAI,
        usage: data.usage,
        costUsd,
      };
    }
    throw new Error('OpenAI returned no image');
  }

  private async fetchOpenAIWithRetry(
    path: string,
    init: () => RequestInit,
  ): Promise<Response> {
    let lastError: OpenAIProviderError | null = null;

    for (
      let attempt = 0;
      attempt <= OpenAIProvider.MAX_TRANSIENT_RETRIES;
      attempt++
    ) {
      const response = await fetch(`https://api.openai.com/v1/${path}`, init());
      if (response.ok) return response;

      const error = await this.buildOpenAIError(response);
      lastError = error;
      if (
        attempt === OpenAIProvider.MAX_TRANSIENT_RETRIES ||
        !this.isRetryableOpenAIError(error)
      ) {
        throw this.toUserFacingOpenAIError(error);
      }

      const delayMs = this.retryDelayMs(error);
      this.logger.warn(
        `OpenAI ${path} attempt ${attempt + 1} failed with retryable ${error.status}; retrying in ${delayMs}ms`,
      );
      await this.delay(delayMs);
    }

    throw lastError ?? new OpenAIProviderError('OPENAI_TEMPORARY_OVERLOAD', '');
  }

  private async buildOpenAIError(response: Response): Promise<OpenAIProviderError> {
    const raw = await response.text();
    this.logger.warn(`OpenAI request failed (${response.status}): ${raw}`);

    let payload: OpenAIErrorPayload | null = null;
    try {
      payload = JSON.parse(raw) as OpenAIErrorPayload;
    } catch {
      // Some failures are plain text; fall back to the HTTP status below.
    }

    const message = payload?.error?.message;
    const code = payload?.error?.code;
    const type = payload?.error?.type;
    const retryAfterMs = this.parseRetryAfterMs(response, message);
    if (this.isSafetyRejection(message, code)) {
      return new OpenAIProviderError(
        this.formatSafetyRejectionCode(message, response),
        raw,
        response.status,
        code,
        type,
        retryAfterMs,
      );
    }

    if (
      code === 'invalid_image_file' ||
      message?.includes('Invalid image file or mode')
    ) {
      return new OpenAIProviderError(
        this.formatInvalidImageFileCode(message),
        raw,
        response.status,
        code,
        type,
        retryAfterMs,
      );
    }

    return new OpenAIProviderError(
      message ? `OpenAI error: ${message}` : `OpenAI error: ${response.statusText}`,
      raw,
      response.status,
      code,
      type,
      retryAfterMs,
    );
  }

  private isRetryableOpenAIError(error: OpenAIProviderError): boolean {
    if (error.code === 'insufficient_quota') return false;
    return error.status === 429 || (error.status !== undefined && error.status >= 500);
  }

  private toUserFacingOpenAIError(error: OpenAIProviderError): OpenAIProviderError {
    if (this.isRetryableOpenAIError(error)) {
      return new OpenAIProviderError(
        'OPENAI_TEMPORARY_OVERLOAD',
        error.providerErrorRaw,
        error.status,
        error.code,
        error.type,
        error.retryAfterMs,
      );
    }
    return error;
  }

  private retryDelayMs(error: OpenAIProviderError): number {
    return Math.min(
      error.retryAfterMs ?? OpenAIProvider.DEFAULT_RETRY_DELAY_MS,
      OpenAIProvider.MAX_RETRY_DELAY_MS,
    );
  }

  private parseRetryAfterMs(response: Response, message?: string): number | undefined {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.max(seconds * 1_000, 0);

      const dateMs = Date.parse(retryAfter);
      if (Number.isFinite(dateMs)) return Math.max(dateMs - Date.now(), 0);
    }

    const secondsFromMessage = message?.match(/try again in\s+(\d+(?:\.\d+)?)s/i)?.[1];
    if (secondsFromMessage) {
      return Math.max(Number(secondsFromMessage) * 1_000, 0);
    }

    return undefined;
  }

  private isSafetyRejection(message?: string, code?: string): boolean {
    return (
      code === 'content_policy_violation' ||
      message?.includes('rejected by the safety system') === true
    );
  }

  private formatSafetyRejectionCode(message: string | undefined, response: Response): string {
    const requestId =
      response.headers.get('x-request-id') ??
      message?.match(/\breq_[a-zA-Z0-9]+\b/)?.[0];
    return requestId
      ? `OPENAI_SAFETY_REJECTED ${requestId}`
      : 'OPENAI_SAFETY_REJECTED';
  }

  private formatInvalidImageFileCode(message?: string): string {
    const imageNumber = message?.match(/image\s+(\d+)/i)?.[1];
    return imageNumber
      ? `OPENAI_INVALID_REFERENCE_IMAGE_${imageNumber}`
      : 'OPENAI_INVALID_REFERENCE_IMAGE';
  }

  // gpt-image-1 only accepts fixed ~1K sizes. gpt-image-2 accepts higher
  // resolutions too, as long as: max edge <= 3840, both edges multiples of 16,
  // long:short ratio <= 3:1, and total pixels between 655,360 and 8,294,400.
  // The values below are hand-picked to satisfy all of those constraints.
  private mapSize(
    model: string,
    ratio: string,
    resolution?: string | null,
  ): string {
    const gptImageOneSizes: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1536x1024',
      '9:16': '1024x1536',
    };

    if (model !== 'gpt-image-2') {
      return gptImageOneSizes[ratio] ?? '1024x1024';
    }

    const byResolution: Record<string, Record<string, string>> = {
      '1K': {
        '1:1': '1024x1024',
        '16:9': '1280x720',
        '9:16': '720x1280',
        '4:3': '1024x768',
        '3:4': '768x1024',
        '3:2': '1200x800',
        '2:3': '800x1200',
        '4:5': '896x1120',
        '5:4': '1120x896',
        '21:9': '1344x576',
        '9:21': '576x1344',
      },
      '2K': {
        '1:1': '2048x2048',
        '16:9': '2048x1152',
        '9:16': '1152x2048',
        '4:3': '2048x1536',
        '3:4': '1536x2048',
        '3:2': '2048x1360',
        '2:3': '1360x2048',
        '4:5': '1600x2000',
        '5:4': '2000x1600',
        '21:9': '2048x880',
        '9:21': '880x2048',
      },
      '4K': {
        '1:1': '2880x2880',
        '16:9': '3840x2160',
        '9:16': '2160x3840',
        '4:3': '3264x2448',
        '3:4': '2448x3264',
        '3:2': '3520x2352',
        '2:3': '2352x3520',
        '4:5': '2560x3200',
        '5:4': '3200x2560',
        '21:9': '3840x1648',
        '9:21': '1648x3840',
      },
    };

    const resolved = byResolution[resolution ?? '1K']?.[ratio] ?? '1024x1024';
    return this.assertValidOpenAiSize(resolved);
  }

  // gpt-image-2 constraints. This is a guard: the tables above are hand-picked
  // to satisfy these rules, so a thrown error here means a bad edit reached the
  // table — better to fail loudly here than to get an opaque 400 from OpenAI.
  private static readonly SIZE_MAX_EDGE = 3840;
  private static readonly SIZE_MIN_PIXELS = 655_360;
  private static readonly SIZE_MAX_PIXELS = 8_294_400;
  private static readonly SIZE_MAX_RATIO = 3;
  private static readonly SIZE_EDGE_MULTIPLE = 16;

  private assertValidOpenAiSize(size: string): string {
    const [w, h] = size.split('x').map(Number);
    const reject = (reason: string): never => {
      throw new OpenAIProviderError(
        `OPENAI_INVALID_SIZE ${size} (${reason})`,
        `Internal size table produced an invalid OpenAI size: ${size} — ${reason}`,
      );
    };

    if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) {
      reject('not a positive WxH pair');
    }
    if (
      Math.max(w, h) > OpenAIProvider.SIZE_MAX_EDGE
    ) {
      reject(`edge exceeds ${OpenAIProvider.SIZE_MAX_EDGE}`);
    }
    const pixels = w * h;
    if (pixels < OpenAIProvider.SIZE_MIN_PIXELS) {
      reject(`fewer than ${OpenAIProvider.SIZE_MIN_PIXELS} pixels`);
    }
    if (pixels > OpenAIProvider.SIZE_MAX_PIXELS) {
      reject(`more than ${OpenAIProvider.SIZE_MAX_PIXELS} pixels`);
    }
    if (Math.max(w, h) / Math.min(w, h) > OpenAIProvider.SIZE_MAX_RATIO) {
      reject(`aspect ratio exceeds ${OpenAIProvider.SIZE_MAX_RATIO}:1`);
    }
    if (
      w % OpenAIProvider.SIZE_EDGE_MULTIPLE !== 0 ||
      h % OpenAIProvider.SIZE_EDGE_MULTIPLE !== 0
    ) {
      reject(`edges must be multiples of ${OpenAIProvider.SIZE_EDGE_MULTIPLE}`);
    }

    return size;
  }

  private mapQuality(quality?: string | null): string {
    const supported = new Set(['low', 'medium', 'high', 'auto']);
    return supported.has(quality ?? '') ? quality! : 'auto';
  }
}
