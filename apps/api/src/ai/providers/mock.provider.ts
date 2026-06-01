import { AiProvider } from '../../common/constants';
import { GenerateImageParams, GenerateImageResult } from '../ai.types';
import { BaseImageProvider } from './base.provider';

export class MockProvider extends BaseImageProvider {
  async generate(params: GenerateImageParams): Promise<GenerateImageResult> {
    const { width, height } = this.dimensions(params.size, params.resolution);
    const encodedPrompt = encodeURIComponent(params.prompt.slice(0, 80));
    const imageUrl = `https://placehold.co/${width}x${height}/1a1a2e/eee?text=${encodedPrompt}`;
    await new Promise((r) => setTimeout(r, 1500));
    return { imageUrl, provider: AiProvider.MOCK };
  }
}
