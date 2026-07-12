import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { In, LessThan, Repository } from 'typeorm';
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
export class GenerationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GenerationsService.name);
  private readonly syncMode: boolean;

  // A generation that has been pending/processing longer than this is considered
  // stuck (orphaned by a server restart or a hung provider call) and is failed +
  // refunded automatically. Generous enough that legitimate slow jobs (e.g. the
  // 10-minute video provider cap) finish well before being reaped.
  private static readonly STUCK_AFTER_MS = 15 * 60 * 1000;
  private static readonly WATCHDOG_EVERY_MS = 5 * 60 * 1000;
  private static readonly STUCK_ERROR_MESSAGE =
    'היצירה נעצרה עקב תקלה במערכת. הקרדיטים הוחזרו לך — אפשר ליצור מחדש.';

  private watchdogTimer: NodeJS.Timeout | null = null;

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

  async onModuleInit() {
    // On boot, any generation still marked pending/processing is orphaned from a
    // previous process that died mid-run — there is nothing running it now, so it
    // would stay stuck forever. Fail + refund it immediately.
    try {
      await this.failStuckGenerations({ startup: true });
    } catch (err) {
      this.logger.error(`Startup stuck-generation cleanup failed: ${err}`);
    }

    // Then keep watching for generations that get stuck while the server is up
    // (e.g. a provider request that hangs with no result).
    this.watchdogTimer = setInterval(() => {
      this.failStuckGenerations({ startup: false }).catch((err) =>
        this.logger.error(`Stuck-generation watchdog failed: ${err}`),
      );
    }, GenerationsService.WATCHDOG_EVERY_MS);
    this.watchdogTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  // Finds generations stuck in a non-terminal state and fails them with a clear,
  // user-facing message while refunding the credits that were charged. On startup
  // every pending/processing row is treated as stuck; while running, only rows
  // older than STUCK_AFTER_MS are touched so in-flight jobs are left alone.
  private async failStuckGenerations({ startup }: { startup: boolean }) {
    const statuses = [GenerationStatus.PENDING, GenerationStatus.PROCESSING];
    const stuck = await this.genRepo.find({
      where: startup
        ? { status: In(statuses) }
        : {
            status: In(statuses),
            createdAt: LessThan(
              new Date(Date.now() - GenerationsService.STUCK_AFTER_MS),
            ),
          },
    });

    if (stuck.length === 0) return;

    this.logger.warn(
      `Reaping ${stuck.length} stuck generation(s) (${
        startup ? 'startup' : 'watchdog'
      })`,
    );

    for (const generation of stuck) {
      // Only flip rows that are still stuck — a row may have completed between
      // the query and this update (especially under the running watchdog).
      const res = await this.genRepo.update(
        { id: generation.id, status: In(statuses) },
        {
          status: GenerationStatus.FAILED,
          errorMessage: GenerationsService.STUCK_ERROR_MESSAGE,
        },
      );
      if (res.affected && generation.creditCost > 0) {
        await this.creditsService.addCredits(
          generation.userId,
          generation.creditCost,
          `refund:stuck:${generation.id}`,
        );
      }
    }
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

  // Soft-deletes a creation the user no longer wants in their list. Ownership is
  // enforced via findById. In-progress jobs can't be removed (they'd finish and
  // resurface, and their credits/queue state are still in flux). The stored asset
  // is intentionally left in place — only the DB row is marked deleted.
  async remove(id: string, userId: string) {
    const generation = await this.findById(id, userId);

    if (
      generation.status === GenerationStatus.PENDING ||
      generation.status === GenerationStatus.PROCESSING
    ) {
      throw new BadRequestException(
        'לא ניתן למחוק יצירה בזמן עיבוד. יש להמתין שתסתיים.',
      );
    }

    await this.genRepo.softDelete(id);
    return { success: true };
  }

  async findByUser(
    userId: string,
    filters?: {
      type?: GenerationType;
      excludeStatuses?: GenerationStatus[];
      limit?: number;
      offset?: number;
    },
  ) {
    const qb = this.genRepo
      .createQueryBuilder('g')
      .where('g.userId = :userId', { userId })
      .orderBy('g.createdAt', 'DESC')
      .addOrderBy('g.id', 'DESC');

    if (filters?.type) {
      qb.andWhere('g.type = :type', { type: filters.type });
    }

    if (filters?.excludeStatuses?.length) {
      qb.andWhere('g.status NOT IN (:...excludeStatuses)', {
        excludeStatuses: filters.excludeStatuses,
      });
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
