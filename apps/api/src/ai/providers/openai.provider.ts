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
  ) {
    super(message);
    this.name = 'OpenAIProviderError';
  }
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
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', params.prompt);
    form.append('size', size);
    form.append('quality', quality);
    form.append('n', '1');

    const imageKey = refs.length > 1 ? 'image[]' : 'image';
    for (const refUrl of refs) {
      const { blob, filename } = await this.fetchReferenceImage(refUrl);
      form.append(imageKey, blob, filename);
    }

    const key = this.config.get('OPENAI_API_KEY');
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    if (!response.ok) {
      await this.throwOpenAIError(response);
    }

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
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: params.prompt, size, quality, n: 1 }),
    });

    if (!response.ok) {
      await this.throwOpenAIError(response);
    }

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

  private async throwOpenAIError(response: Response): Promise<never> {
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
    if (this.isSafetyRejection(message, code)) {
      throw new OpenAIProviderError(
        this.formatSafetyRejectionCode(message, response),
        raw,
      );
    }

    if (
      code === 'invalid_image_file' ||
      message?.includes('Invalid image file or mode')
    ) {
      throw new OpenAIProviderError(this.formatInvalidImageFileCode(message), raw);
    }

    throw new OpenAIProviderError(
      message ? `OpenAI error: ${message}` : `OpenAI error: ${response.statusText}`,
      raw,
    );
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
    const oneK: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1536x1024',
      '9:16': '1024x1536',
      '4:3': '1536x1024',
    };

    if (model !== 'gpt-image-2') {
      return oneK[ratio] ?? '1024x1024';
    }

    const byResolution: Record<string, Record<string, string>> = {
      '1K': oneK,
      '2K': {
        '1:1': '2048x2048',
        '16:9': '2048x1152',
        '9:16': '1152x2048',
        '4:3': '2048x1536',
      },
      '4K': {
        '1:1': '2880x2880',
        '16:9': '3840x2160',
        '9:16': '2160x3840',
        '4:3': '3264x2448',
      },
    };

    return byResolution[resolution ?? '1K']?.[ratio] ?? oneK[ratio] ?? '1024x1024';
  }

  private mapQuality(quality?: string | null): string {
    const map: Record<string, string> = { fast: 'low', standard: 'medium', hd: 'high' };
    return map[quality ?? ''] ?? 'medium';
  }
}
