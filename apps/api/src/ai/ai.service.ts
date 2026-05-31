import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateImageParams, GenerateImageResult } from './ai.types';
import { AiProvider } from '../common/constants';
import { BaseImageProvider } from './providers/base.provider';
import { MockProvider } from './providers/mock.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GoogleProvider } from './providers/google.provider';
import { ReplicateProvider } from './providers/replicate.provider';
import { FalProvider } from './providers/fal.provider';
import { StabilityProvider } from './providers/stability.provider';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly providers: Map<AiProvider, BaseImageProvider>;

  constructor(private readonly config: ConfigService) {
    this.providers = new Map([
      [AiProvider.MOCK, new MockProvider(config)],
      [AiProvider.OPENAI, new OpenAIProvider(config)],
      [AiProvider.GOOGLE, new GoogleProvider(config)],
      [AiProvider.REPLICATE, new ReplicateProvider(config)],
      [AiProvider.FAL, new FalProvider(config)],
      [AiProvider.STABILITY, new StabilityProvider(config)],
    ]);
  }

  resolveProvider(requested: string): AiProvider {
    const map: Record<string, AiProvider> = {
      replicate: AiProvider.REPLICATE,
      fal: AiProvider.FAL,
      openai: AiProvider.OPENAI,
      stability: AiProvider.STABILITY,
      google: AiProvider.GOOGLE,
      mock: AiProvider.MOCK,
    };

    const provider = map[requested] ?? AiProvider.MOCK;
    if (this.isConfigured(provider)) return provider;

    this.logger.warn(`Provider ${provider} not configured, falling back to mock`);
    return AiProvider.MOCK;
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    const provider = this.resolveProvider(params.provider);
    const handler = this.providers.get(provider) ?? this.providers.get(AiProvider.MOCK)!;
    return handler.generate(params);
  }

  private isConfigured(provider: AiProvider): boolean {
    const keys: Partial<Record<AiProvider, string>> = {
      [AiProvider.REPLICATE]: 'REPLICATE_API_TOKEN',
      [AiProvider.FAL]: 'FAL_KEY',
      [AiProvider.OPENAI]: 'OPENAI_API_KEY',
      [AiProvider.STABILITY]: 'STABILITY_API_KEY',
      [AiProvider.GOOGLE]: 'GOOGLE_API_KEY',
    };
    const key = keys[provider];
    return key ? !!this.config.get(key) : true;
  }
}
