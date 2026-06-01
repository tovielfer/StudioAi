import { AiProvider } from '../../common/constants';
import { GenerateImageParams, GenerateImageResult } from '../ai.types';
import { BaseImageProvider } from './base.provider';

export class ReplicateProvider extends BaseImageProvider {
  async generate(params: GenerateImageParams): Promise<GenerateImageResult> {
    const token = this.config.get('REPLICATE_API_TOKEN');
    const model = params.model || 'black-forest-labs/flux-schnell';
    const { width, height } = this.dimensions(params.size, params.resolution);
    const firstRef = this.resolveReferenceImages(params)[0];

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
          ...(firstRef ? { image: firstRef } : {}),
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Replicate error: ${err}`);
    }

    const data = (await response.json()) as { output?: string | string[] };
    const output = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!output) throw new Error('Replicate returned no output');

    return { imageUrl: output, provider: AiProvider.REPLICATE };
  }
}
