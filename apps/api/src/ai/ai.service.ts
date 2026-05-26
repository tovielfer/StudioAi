import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateImageParams, GenerateImageResult } from './ai.types';
import { AiProvider } from '../common/constants';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  resolveProvider(requested: string): AiProvider {
    const map: Record<string, AiProvider> = {
      replicate: AiProvider.REPLICATE,
      fal: AiProvider.FAL,
      openai: AiProvider.OPENAI,
      stability: AiProvider.STABILITY,
      mock: AiProvider.MOCK,
    };

    const provider = map[requested] ?? AiProvider.MOCK;
    if (this.isProviderConfigured(provider)) return provider;

    this.logger.warn(
      `Provider ${provider} not configured, falling back to mock`,
    );
    return AiProvider.MOCK;
  }

  private isProviderConfigured(provider: AiProvider): boolean {
    switch (provider) {
      case AiProvider.REPLICATE:
        return !!this.config.get('REPLICATE_API_TOKEN');
      case AiProvider.FAL:
        return !!this.config.get('FAL_KEY');
      case AiProvider.OPENAI:
        return !!this.config.get('OPENAI_API_KEY');
      case AiProvider.STABILITY:
        return !!this.config.get('STABILITY_API_KEY');
      default:
        return true;
    }
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    const provider = this.resolveProvider(params.provider);

    switch (provider) {
      case AiProvider.REPLICATE:
        return this.generateReplicate(params);
      case AiProvider.FAL:
        return this.generateFal(params);
      case AiProvider.OPENAI:
        return this.generateOpenAI(params);
      case AiProvider.STABILITY:
        return this.generateStability(params);
      default:
        return this.generateMock(params);
    }
  }

  private sizeToDimensions(size: string): { width: number; height: number } {
    const map: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '4:3': { width: 1152, height: 896 },
    };
    return map[size] ?? map['1:1'];
  }

  private async generateMock(
    params: GenerateImageParams,
  ): Promise<GenerateImageResult> {
    const { width, height } = this.sizeToDimensions(params.size);
    const encodedPrompt = encodeURIComponent(params.prompt.slice(0, 80));
    const imageUrl = `https://placehold.co/${width}x${height}/1a1a2e/eee?text=${encodedPrompt}`;
    await new Promise((r) => setTimeout(r, 1500));
    return { imageUrl, provider: AiProvider.MOCK };
  }

  private async generateReplicate(
    params: GenerateImageParams,
  ): Promise<GenerateImageResult> {
    const token = this.config.get('REPLICATE_API_TOKEN');
    const model =
      params.model || 'black-forest-labs/flux-schnell';

    const { width, height } = this.sizeToDimensions(params.size);

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        version: model.includes('/') ? undefined : model,
        model: model.includes('/') ? model : undefined,
        input: {
          prompt: params.prompt,
          width,
          height,
          ...(params.referenceImage
            ? { image: params.referenceImage }
            : {}),
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Replicate error: ${err}`);
    }

    const data = (await response.json()) as {
      output?: string | string[];
    };

    const output = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!output) throw new Error('Replicate returned no output');

    return { imageUrl: output, provider: AiProvider.REPLICATE };
  }

  private resolveFalEndpoint(model?: string): string {
    const defaults: Record<string, string> = {
      'fal-flux': 'https://fal.run/fal-ai/flux/schnell',
      'flux-schnell': 'https://fal.run/fal-ai/flux/schnell',
    };
    if (model?.startsWith('http')) return model;
    return defaults[model ?? ''] ?? 'https://fal.run/fal-ai/flux/schnell';
  }

  private async generateFal(
    params: GenerateImageParams,
  ): Promise<GenerateImageResult> {
    const key = this.config.get('FAL_KEY');
    const endpoint = this.resolveFalEndpoint(params.model);

    const { width, height } = this.sizeToDimensions(params.size);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: params.prompt,
        image_size: { width, height },
        ...(params.referenceImage
          ? { image_url: params.referenceImage }
          : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Fal.ai error: ${err}`);
    }

    const data = (await response.json()) as {
      images?: { url: string }[];
    };

    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) throw new Error('Fal.ai returned no image');

    return { imageUrl, provider: AiProvider.FAL };
  }

  private resolveOpenAIModel(model?: string): string {
    return model ?? 'gpt-image-1';
  }

  private openAISizeFromAspectRatio(size: string): string {
    const map: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1536x1024',
      '9:16': '1024x1536',
      '4:3': '1536x1024',
    };
    return map[size] ?? '1024x1024';
  }

  private async generateOpenAI(
    params: GenerateImageParams,
  ): Promise<GenerateImageResult> {
    const key = this.config.get('OPENAI_API_KEY');
    const model = this.resolveOpenAIModel(params.model);
    const size = this.openAISizeFromAspectRatio(params.size);

    const response = await fetch(
      'https://api.openai.com/v1/images/generations',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: params.prompt,
          size,
          n: 1,
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data = (await response.json()) as {
      data?: { url?: string; b64_json?: string }[];
    };

    const item = data.data?.[0];
    if (item?.url) {
      return { imageUrl: item.url, provider: AiProvider.OPENAI };
    }
    if (item?.b64_json) {
      return {
        imageUrl: `data:image/png;base64,${item.b64_json}`,
        provider: AiProvider.OPENAI,
      };
    }

    throw new Error('OpenAI returned no image');
  }

  private async generateStability(
    params: GenerateImageParams,
  ): Promise<GenerateImageResult> {
    const key = this.config.get('STABILITY_API_KEY');
    const { width, height } = this.sizeToDimensions(params.size);

    const response = await fetch(
      'https://api.stability.ai/v2beta/stable-image/generate/sd3',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
        body: (() => {
          const form = new FormData();
          form.append('prompt', params.prompt);
          form.append('output_format', 'png');
          form.append('aspect_ratio', params.size.replace(':', ':'));
          form.append('width', String(width));
          form.append('height', String(height));
          if (params.referenceImage) {
            form.append('image', params.referenceImage);
          }
          return form;
        })(),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Stability AI error: ${err}`);
    }

    const data = (await response.json()) as { image?: string };
    if (!data.image) throw new Error('Stability AI returned no image');

    return {
      imageUrl: `data:image/png;base64,${data.image}`,
      provider: AiProvider.STABILITY,
    };
  }
}
