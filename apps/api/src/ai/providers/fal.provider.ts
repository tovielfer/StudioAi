import { AiProvider } from '../../common/constants';
import { GenerateImageParams, GenerateImageResult } from '../ai.types';
import { BaseImageProvider } from './base.provider';

export class FalProvider extends BaseImageProvider {
  async generate(params: GenerateImageParams): Promise<GenerateImageResult> {
    const key = this.config.get('FAL_KEY');
    const endpoint = this.resolveEndpoint(params.model);
    const { width, height } = this.dimensions(params.size, params.resolution);
    const firstRef = this.resolveReferenceImages(params)[0];

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        image_size: { width, height },
        ...(firstRef ? { image_url: firstRef } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Fal.ai error: ${err}`);
    }

    const data = (await response.json()) as { images?: { url: string }[] };
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) throw new Error('Fal.ai returned no image');

    return { imageUrl, provider: AiProvider.FAL };
  }

  private resolveEndpoint(model?: string): string {
    const defaults: Record<string, string> = {
      'fal-flux': 'https://fal.run/fal-ai/flux/schnell',
      'flux-schnell': 'https://fal.run/fal-ai/flux/schnell',
    };
    if (model?.startsWith('http')) return model;
    return defaults[model ?? ''] ?? 'https://fal.run/fal-ai/flux/schnell';
  }
}
