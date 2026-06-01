import { AiProvider } from '../../common/constants';
import { GenerateImageParams, GenerateImageResult } from '../ai.types';
import { BaseImageProvider } from './base.provider';

export class StabilityProvider extends BaseImageProvider {
  async generate(params: GenerateImageParams): Promise<GenerateImageResult> {
    const key = this.config.get('STABILITY_API_KEY');
    const { width, height } = this.dimensions(params.size, params.resolution);
    const firstRef = this.resolveReferenceImages(params)[0];

    const form = new FormData();
    form.append('prompt', params.prompt);
    form.append('output_format', 'png');
    form.append('aspect_ratio', params.size);
    form.append('width', String(width));
    form.append('height', String(height));
    if (firstRef) form.append('image', firstRef);

    const response = await fetch(
      'https://api.stability.ai/v2beta/stable-image/generate/sd3',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        body: form,
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Stability AI error: ${err}`);
    }

    const data = (await response.json()) as { image?: string };
    if (!data.image) throw new Error('Stability AI returned no image');

    return { imageUrl: `data:image/png;base64,${data.image}`, provider: AiProvider.STABILITY };
  }
}
