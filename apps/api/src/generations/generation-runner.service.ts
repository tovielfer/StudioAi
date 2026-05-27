import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Generation } from './generation.entity';
import { GenerationStatus, AiProvider } from '../common/constants';
import { AiService } from '../ai/ai.service';
import { StorageService } from '../storage/storage.service';
import { CreditsService } from '../credits/credits.service';

@Injectable()
export class GenerationRunnerService {
  private readonly logger = new Logger(GenerationRunnerService.name);

  constructor(
    @InjectRepository(Generation)
    private readonly genRepo: Repository<Generation>,
    private readonly aiService: AiService,
    private readonly storageService: StorageService,
    private readonly creditsService: CreditsService,
  ) {}

  async run(generationId: string, isLastAttempt = true) {
    this.logger.log(`Processing generation ${generationId}`);

    const generation = await this.genRepo.findOne({
      where: { id: generationId },
    });
    if (!generation) {
      this.logger.error(`Generation ${generationId} not found`);
      return;
    }

    await this.genRepo.update(generationId, {
      status: GenerationStatus.PROCESSING,
    });

    try {
      const result = await this.aiService.generateImage({
        prompt: generation.prompt,
        model: generation.model,
        size: generation.size,
        quality: generation.quality,
        referenceImage: generation.referenceImageUrl,
        provider: generation.provider,
      });

      let resultUrl = result.imageUrl;
      if (
        resultUrl.startsWith('http') &&
        !resultUrl.includes('placehold.co')
      ) {
        resultUrl = await this.storageService.uploadFromUrl(resultUrl);
      } else if (resultUrl.startsWith('data:')) {
        const base64 = resultUrl.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');
        resultUrl = await this.storageService.uploadBuffer(
          buffer,
          'png',
          'image/png',
        );
      }

      await this.genRepo.update(generationId, {
        status: GenerationStatus.DONE,
        resultUrl,
        provider: result.provider as AiProvider,
        errorMessage: null,
      });

      this.logger.log(`Generation ${generationId} completed`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      const name = error instanceof Error ? error.name : 'Error';
      this.logger.error(
        `Generation ${generationId} failed [${name}]: ${message}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (isLastAttempt) {
        await this.genRepo.update(generationId, {
          status: GenerationStatus.FAILED,
          errorMessage: message,
        });

        if (generation.creditCost > 0) {
          await this.creditsService.addCredits(
            generation.userId,
            generation.creditCost,
            `refund:failed:${generationId}`,
          );
        }
      }

      throw error;
    }
  }
}
