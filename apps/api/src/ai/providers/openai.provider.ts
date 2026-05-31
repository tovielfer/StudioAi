import { Logger } from '@nestjs/common';
import { AiProvider } from '../../common/constants';
import { GenerateImageParams, GenerateImageResult, ImageUsage } from '../ai.types';
import { BaseImageProvider } from './base.provider';

export class OpenAIProvider extends BaseImageProvider {
  private readonly logger = new Logger(OpenAIProvider.name);

  async generate(params: GenerateImageParams): Promise<GenerateImageResult> {
    const model = params.model ?? 'gpt-image-1';
    const size = this.mapSize(params.size);
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

    for (const refUrl of refs) {
      const { blob, filename } = await this.fetchReferenceImage(refUrl);
      form.append('image', blob, filename);
    }

    const key = this.config.get('OPENAI_API_KEY');
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data = (await response.json()) as {
      data?: { url?: string; b64_json?: string }[];
      usage?: ImageUsage;
    };

    this.logger.log(
      `OpenAI edit — input: ${data.usage?.input_tokens ?? 'N/A'}, output: ${data.usage?.output_tokens ?? 'N/A'}`,
    );

    return this.parseImageResponse(data);
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
      const err = await response.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data = (await response.json()) as {
      data?: { url?: string; b64_json?: string }[];
      usage?: ImageUsage;
    };

    this.logger.log(
      `OpenAI generate — input: ${data.usage?.input_tokens ?? 'N/A'}, output: ${data.usage?.output_tokens ?? 'N/A'}`,
    );

    return this.parseImageResponse(data);
  }

  private parseImageResponse(data: {
    data?: { url?: string; b64_json?: string }[];
    usage?: ImageUsage;
  }): GenerateImageResult {
    const item = data.data?.[0];
    if (item?.url) return { imageUrl: item.url, provider: AiProvider.OPENAI, usage: data.usage };
    if (item?.b64_json) {
      return {
        imageUrl: `data:image/png;base64,${item.b64_json}`,
        provider: AiProvider.OPENAI,
        usage: data.usage,
      };
    }
    throw new Error('OpenAI returned no image');
  }

  private mapSize(size: string): string {
    const map: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1536x1024',
      '9:16': '1024x1536',
      '4:3': '1536x1024',
    };
    return map[size] ?? '1024x1024';
  }

  private mapQuality(quality?: string): string {
    const map: Record<string, string> = { fast: 'low', standard: 'medium', hd: 'high' };
    return map[quality ?? ''] ?? 'medium';
  }
}
