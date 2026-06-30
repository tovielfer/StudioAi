import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Generation } from './generation.entity';
import { GenerationStatus, AiProvider } from '../common/constants';
import { AiService } from '../ai/ai.service';
import { StorageService } from '../storage/storage.service';
import { CreditsService } from '../credits/credits.service';

function providerErrorRaw(error: unknown): string | null {
  if (
    error instanceof Error &&
    'providerErrorRaw' in error &&
    typeof error.providerErrorRaw === 'string'
  ) {
    return error.providerErrorRaw;
  }
  return null;
}

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

  // Re-reads only the status so we can detect an admin cancel that happened
  // while the provider request was in flight.
  private async wasCancelled(generationId: string): Promise<boolean> {
    const current = await this.genRepo.findOne({
      where: { id: generationId },
      select: { id: true, status: true },
    });
    return current?.status === GenerationStatus.CANCELLED;
  }

  async run(generationId: string, isLastAttempt = true) {
    this.logger.log(`Processing generation ${generationId}`);

    const generation = await this.genRepo.findOne({
      where: { id: generationId },
    });
    if (!generation) {
      this.logger.error(`Generation ${generationId} not found`);
      return;
    }

    // An admin may have stopped the generation while it was still queued.
    // Respect that and skip processing so it isn't revived.
    if (generation.status === GenerationStatus.CANCELLED) {
      this.logger.warn(
        `Generation ${generationId} was cancelled — skipping processing`,
      );
      return;
    }

    await this.genRepo.update(generationId, {
      status: GenerationStatus.PROCESSING,
    });

    try {
      const result = await this.aiService.generateImage({
        prompt: generation.prompt,
        model: generation.model,
        type: generation.type,
        size: generation.size,
        quality: generation.quality,
        resolution: generation.resolution,
        referenceImages: generation.referenceImageUrls ?? undefined,
        provider: generation.provider,
        durationSeconds: generation.durationSeconds,
        generateAudio: generation.generateAudio,
      });

      let resultUrl = result.imageUrl;
      if (
        resultUrl.startsWith('http') &&
        !resultUrl.includes('placehold.co')
      ) {
        try {
          resultUrl = await this.storageService.uploadFromUrl(resultUrl);
        } catch (uploadError) {
          const msg = uploadError instanceof Error ? uploadError.message : String(uploadError);
          if (msg.includes('Blocked by NetFree')) {
            this.logger.warn(`Asset blocked by NetFree during upload. Using original URL: ${result.imageUrl}`);
            // Keep the original resultUrl
          } else {
            throw uploadError;
          }
        }
      } else if (resultUrl.startsWith('data:')) {
        const base64 = resultUrl.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');
        resultUrl = await this.storageService.uploadBuffer(
          buffer,
          'png',
          'image/png',
        );
      }

      // An admin may have stopped the generation while the provider call was in
      // flight. Don't overwrite the CANCELLED status (and don't keep a result the
      // user was already refunded for).
      if (await this.wasCancelled(generationId)) {
        this.logger.warn(
          `Generation ${generationId} was cancelled during processing — discarding result`,
        );
        return;
      }

      await this.genRepo.update(generationId, {
        status: GenerationStatus.DONE,
        resultUrl,
        provider: result.provider as AiProvider,
        errorMessage: null,
        providerErrorRaw: null,
        tokensUsed: result.usage ?? null,
        actualCostUsd: result.costUsd ?? null,
      });

      if (result.usage) {
        this.logger.log(
          `Generation ${generationId} completed — tokens: input=${result.usage.input_tokens}, output=${result.usage.output_tokens}, total=${result.usage.total_tokens}, cost=$${(result.costUsd ?? 0).toFixed(5)}`,
        );
      } else {
        this.logger.log(`Generation ${generationId} completed`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      const name = error instanceof Error ? error.name : 'Error';
      this.logger.error(
        `Generation ${generationId} failed [${name}]: ${message}`,
        error instanceof Error ? error.stack : String(error),
      );

      if (isLastAttempt) {
        // If an admin cancelled mid-flight, the status is already CANCELLED and
        // the credits were already refunded. Don't overwrite it or refund twice.
        if (await this.wasCancelled(generationId)) {
          this.logger.warn(
            `Generation ${generationId} failed after being cancelled — leaving as cancelled`,
          );
          return;
        }

        await this.genRepo.update(generationId, {
          status: GenerationStatus.FAILED,
          errorMessage: message,
          providerErrorRaw: providerErrorRaw(error),
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
