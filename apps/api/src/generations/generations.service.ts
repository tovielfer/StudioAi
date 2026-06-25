import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Optional,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Generation } from './generation.entity';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { CreditsService } from '../credits/credits.service';
import { GenerationRunnerService } from './generation-runner.service';
import {
  GenerationStatus,
  GenerationType,
  ImageQuality,
  ImageSize,
  ImageResolution,
  AiProvider,
} from '../common/constants';
import { moderatePrompt } from '../common/moderation';
import {
  normalizeAttrs,
  normalizeVideoDuration,
  modelSupportsAudio,
} from '../common/model-capabilities';
import { AiPricingService } from '../ai/ai-pricing.service';

export const GENERATION_QUEUE = 'generation';

@Injectable()
export class GenerationsService {
  private readonly logger = new Logger(GenerationsService.name);
  private readonly syncMode: boolean;

  constructor(
    @InjectRepository(Generation)
    private readonly genRepo: Repository<Generation>,
    @Optional() @InjectQueue(GENERATION_QUEUE) private readonly queue: Queue | null,
    private readonly creditsService: CreditsService,
    private readonly runner: GenerationRunnerService,
    private readonly pricingService: AiPricingService,
    config: ConfigService,
  ) {
    this.syncMode = config.get('QUEUE_MODE') === 'sync';
  }

  async create(userId: string, dto: CreateGenerationDto) {
    moderatePrompt(dto.prompt);

    const type = dto.type ?? GenerationType.IMAGE;
    const size = dto.size ?? ImageSize.SQUARE;
    const provider = dto.provider ?? AiProvider.MOCK;

    // Strip parameters the model does not honour (see MODEL_REGISTRY) so the
    // DB, pricing and provider request stay in sync.
    const { quality, resolution } = normalizeAttrs(
      dto.model,
      dto.quality ?? ImageQuality.AUTO,
      dto.resolution ?? ImageResolution.ONE_K,
    );

    const allReferenceUrls = dto.referenceImageUrls ?? [];
    const hasReference = allReferenceUrls.length > 0;

    // Video-only controls: clamp the duration to what the model supports and
    // drop audio for models that don't support it, so the persisted/priced/sent
    // values all agree.
    const isVideo = type === GenerationType.VIDEO;
    const durationSeconds = isVideo
      ? normalizeVideoDuration(dto.model, dto.durationSeconds)
      : null;
    const generateAudio = isVideo
      ? modelSupportsAudio(dto.model) && Boolean(dto.generateAudio)
      : null;

    const { credits: creditCost, ruleId } =
      await this.pricingService.getGenerationCost({
      provider,
      model: dto.model,
      size,
      quality,
      resolution,
      hasReference,
      type,
      durationSeconds,
      generateAudio,
    });

    const generation = this.genRepo.create({
      userId,
      prompt: dto.prompt,
      model: dto.model,
      type,
      quality: quality as ImageQuality | null,
      size,
      resolution: resolution as ImageResolution | null,
      provider,
      referenceImageUrls: allReferenceUrls.length > 0 ? allReferenceUrls : null,
      durationSeconds,
      generateAudio,
      status: GenerationStatus.PENDING,
      creditCost,
      pricingRuleId: ruleId,
    });

    await this.creditsService.deductCredits(
      userId,
      creditCost,
      `generation:${type}:${provider}:${dto.model}`,
    );

    const saved = await this.genRepo.save(generation);

    if (this.syncMode) {
      setImmediate(() => {
        this.runner.run(saved.id).catch((err) => {
          this.logger.error(`Sync generation failed: ${err}`);
        });
      });
      this.logger.log(`Processing generation ${saved.id} inline (sync mode)`);
    } else if (this.queue) {
      await this.queue.add(
        'process',
        { generationId: saved.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
      this.logger.log(`Queued generation ${saved.id} for user ${userId}`);
    }

    return saved;
  }

  async findById(id: string, userId?: string) {
    const gen = await this.genRepo.findOne({ where: { id } });
    if (!gen) throw new NotFoundException('Generation not found');
    if (userId && gen.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return gen;
  }

  async findByUser(
    userId: string,
    filters?: { type?: GenerationType; limit?: number; offset?: number },
  ) {
    const qb = this.genRepo
      .createQueryBuilder('g')
      .where('g.userId = :userId', { userId })
      .orderBy('g.createdAt', 'DESC');

    if (filters?.type) {
      qb.andWhere('g.type = :type', { type: filters.type });
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    qb.take(limit).skip(offset);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async updateStatus(
    id: string,
    status: GenerationStatus,
    extras?: Partial<Generation>,
  ) {
    await this.genRepo.update(id, { status, ...extras });
    return this.genRepo.findOne({ where: { id } });
  }

  async refundOnFailure(generation: Generation) {
    if (generation.creditCost > 0) {
      await this.creditsService.addCredits(
        generation.userId,
        generation.creditCost,
        `refund:failed:${generation.id}`,
      );
    }
  }
}
