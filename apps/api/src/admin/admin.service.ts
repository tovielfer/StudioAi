import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository, SelectQueryBuilder } from 'typeorm';
import { AiPricingRuleAuditLog } from '../ai/ai-pricing-rule-audit-log.entity';
import { AiPricingRule } from '../ai/ai-pricing-rule.entity';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { CreditsService } from '../credits/credits.service';
import { Generation } from '../generations/generation.entity';
import { GenerationStatus } from '../common/constants';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { creditsToIls, getBillingConfig, usdToCredits } from '../config/billing';
import { User, UserRole } from '../users/user.entity';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';

type PricingMetric = {
  generationCount: number;
  doneCount: number;
  failedCount: number;
  totalCredits: number;
  avgCredits: number;
  totalActualCostUsd: number;
  avgActualCostUsd: number;
  estimatedGrossUsd: number;
  estimatedMarginUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalInputImageTokens: number;
  totalOutputImageTokens: number;
};

const EMPTY_PRICING_METRIC: PricingMetric = {
  generationCount: 0,
  doneCount: 0,
  failedCount: 0,
  totalCredits: 0,
  avgCredits: 0,
  totalActualCostUsd: 0,
  avgActualCostUsd: 0,
  estimatedGrossUsd: 0,
  estimatedMarginUsd: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalInputImageTokens: 0,
  totalOutputImageTokens: 0,
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Generation)
    private readonly generationsRepo: Repository<Generation>,
    @InjectRepository(CreditTransaction)
    private readonly creditTransactionsRepo: Repository<CreditTransaction>,
    @InjectRepository(AiPricingRule)
    private readonly pricingRulesRepo: Repository<AiPricingRule>,
    @InjectRepository(AiPricingRuleAuditLog)
    private readonly pricingAuditRepo: Repository<AiPricingRuleAuditLog>,
    private readonly creditsService: CreditsService,
    private readonly mailService: MailService,
    private readonly storageService: StorageService,
  ) {}

  // Emails a finished generation's asset to the given recipient (the admin's
  // own address). Unlike the user-facing flow this isn't restricted to the
  // generation owner, so an admin can pull any user's result into their inbox.
  async sendGenerationEmail(id: string, to: string) {
    const generation = await this.generationsRepo.findOne({ where: { id } });
    if (!generation) {
      throw new NotFoundException('Generation not found');
    }

    if (generation.status !== GenerationStatus.DONE || !generation.resultUrl) {
      throw new BadRequestException('Generation is not ready to be sent');
    }

    await this.mailService.sendGenerationImage({ to, generation });

    return { success: true };
  }

  // Lets an admin stop a generation that is still pending or processing. The
  // status is moved to CANCELLED and any credits charged for it are refunded.
  async cancelGeneration(id: string) {
    const generation = await this.generationsRepo.findOne({ where: { id } });
    if (!generation) {
      throw new NotFoundException('Generation not found');
    }

    if (
      generation.status !== GenerationStatus.PENDING &&
      generation.status !== GenerationStatus.PROCESSING
    ) {
      throw new BadRequestException(
        'Only pending or processing generations can be stopped',
      );
    }

    await this.generationsRepo.update(id, {
      status: GenerationStatus.CANCELLED,
      errorMessage: 'בוטל על ידי מנהל',
    });

    if (generation.creditCost > 0) {
      await this.creditsService.addCredits(
        generation.userId,
        generation.creditCost,
        `refund:cancelled:${id}`,
      );
    }

    const updated = await this.generationsRepo.findOne({ where: { id } });
    return updated ?? { ...generation, status: GenerationStatus.CANCELLED };
  }

  // Permanently removes generations: deletes the stored result asset from
  // storage and then hard-deletes the DB row. An admin can remove any creation,
  // including ones the user never deleted — the only exception is generations
  // that are still running (pending/processing), which must be cancelled first
  // so we don't nuke a live job mid-run. Returns how many rows were removed.
  async hardDeleteGenerations(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      throw new BadRequestException('No generations specified');
    }

    const generations = await this.generationsRepo.find({
      where: { id: In(uniqueIds) },
      withDeleted: true,
    });

    const deletable = generations.filter(
      (g) =>
        g.status !== GenerationStatus.PENDING &&
        g.status !== GenerationStatus.PROCESSING,
    );
    if (deletable.length === 0) {
      throw new BadRequestException(
        'Cannot permanently remove generations that are still pending or processing — cancel them first',
      );
    }

    // Best-effort asset cleanup first; storage failures are logged inside the
    // service and never block removal of the DB row.
    await Promise.all(
      deletable.map((g) => this.storageService.deleteByUrl(g.resultUrl)),
    );

    const deletableIds = deletable.map((g) => g.id);
    await this.generationsRepo.delete(deletableIds);

    return { success: true, deleted: deletableIds.length, ids: deletableIds };
  }

  async getStats() {
    const [usersTotal, generationsTotal, creditTotals, statusRows] =
      await Promise.all([
        this.usersRepo.count(),
        // Include soft-deleted rows: they still represent real activity and spend.
        this.generationsRepo.count({ withDeleted: true }),
        this.getCreditTotals(),
        this.generationsRepo
          .createQueryBuilder('g')
          .withDeleted()
          .select('g.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('g.status')
          .getRawMany<{ status: string; count: string }>(),
      ]);

    return {
      usersTotal,
      generationsTotal,
      creditsIssued: creditTotals.issued,
      creditsSpent: creditTotals.spent,
      generationsByStatus: statusRows.reduce<Record<string, number>>(
        (acc, row) => {
          acc[row.status] = Number(row.count);
          return acc;
        },
        {},
      ),
    };
  }

  async listUsers(params: {
    search?: string;
    limit: number;
    offset: number;
    sort?: 'newest' | 'oldest' | 'generations' | 'credits' | 'email';
  }) {
    const where = params.search
      ? [
          { email: ILike(`%${params.search}%`) },
          { nickname: ILike(`%${params.search}%`) },
        ]
      : {};

    const total = await this.usersRepo.count({ where });

    const qb = this.usersRepo
      .createQueryBuilder('u')
      // Include soft-deleted generations so the per-user count matches the rest
      // of the admin views (getStats/listGenerations), which count all activity.
      .withDeleted()
      .leftJoin('generations', 'g', 'g."userId" = u.id')
      .select('u.id', 'id')
      .addSelect('u.email', 'email')
      .addSelect('u.nickname', 'nickname')
      .addSelect('u.credits', 'credits')
      .addSelect('u.role', 'role')
      .addSelect('u."isBlocked"', 'isBlocked')
      .addSelect('u."emailVerified"', 'emailVerified')
      .addSelect('u."createdAt"', 'createdAt')
      .addSelect('COUNT(g.id)::int', 'generationsCount')
      .groupBy('u.id');

    if (params.search) {
      qb.where('(u.email ILIKE :s OR u.nickname ILIKE :s)', {
        s: `%${params.search}%`,
      });
    }

    switch (params.sort) {
      case 'generations':
        qb.orderBy('COUNT(g.id)', 'DESC').addOrderBy('u."createdAt"', 'DESC');
        break;
      case 'credits':
        qb.orderBy('u.credits', 'DESC').addOrderBy('u."createdAt"', 'DESC');
        break;
      case 'oldest':
        qb.orderBy('u."createdAt"', 'ASC');
        break;
      case 'email':
        qb.orderBy('LOWER(u.email)', 'ASC');
        break;
      case 'newest':
      default:
        qb.orderBy('u."createdAt"', 'DESC');
        break;
    }

    const rows = await qb.limit(params.limit).offset(params.offset).getRawMany();

    const items = rows.map((r) => ({
      id: r.id as string,
      email: r.email as string,
      nickname: (r.nickname as string | null) ?? null,
      credits: Number(r.credits),
      role: r.role as string,
      isBlocked: Boolean(r.isBlocked),
      emailVerified: Boolean(r.emailVerified),
      createdAt: r.createdAt as Date,
      generationsCount: Number(r.generationsCount),
    }));

    return { items, total };
  }

  async updateUser(
    userId: string,
    dto: { nickname?: string | null; isBlocked?: boolean },
    adminUserId?: string,
  ) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.nickname !== undefined) {
      const trimmed = dto.nickname?.trim();
      user.nickname = trimmed ? trimmed : null;
    }
    if (dto.isBlocked !== undefined) {
      if (dto.isBlocked && user.id === adminUserId) {
        throw new BadRequestException('You cannot block your own admin user');
      }
      if (dto.isBlocked && user.role === UserRole.ADMIN) {
        throw new BadRequestException('Admin users cannot be blocked');
      }
      user.isBlocked = dto.isBlocked;
    }
    await this.usersRepo.save(user);

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      credits: user.credits,
      role: user.role,
      isBlocked: user.isBlocked,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  // Sends a one-off branded email to a specific user from the admin area.
  async sendUserEmail(userId: string, subject: string, message: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.mailService.sendCustomEmail({
      to: user.email,
      subject: subject.trim(),
      message: message.trim(),
    });

    return { success: true };
  }

  async listCreditTransactions(params: {
    search?: string;
    userId?: string;
    direction?: 'credit' | 'debit';
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  }) {
    const qb = this.creditTransactionsRepo
      .createQueryBuilder('tx')
      .leftJoin('tx.user', 'user');

    if (params.search) {
      qb.andWhere('(tx.reason ILIKE :search OR user.email ILIKE :search)', {
        search: `%${params.search}%`,
      });
    }

    if (params.userId) {
      qb.andWhere('tx.userId = :userId', { userId: params.userId });
    }

    if (params.direction === 'credit') {
      qb.andWhere('tx.amount > 0');
    }

    if (params.direction === 'debit') {
      qb.andWhere('tx.amount < 0');
    }

    const fromDate = this.parseDateFilter(params.from, 'start');
    if (fromDate) {
      qb.andWhere('tx.createdAt >= :fromDate', { fromDate });
    }

    const toDate = this.parseDateFilter(params.to, 'end');
    if (toDate) {
      qb.andWhere('tx.createdAt <= :toDate', { toDate });
    }

    const [total, summaryRow, items] = await Promise.all([
      qb.clone().getCount(),
      qb
        .clone()
        .select(
          'COALESCE(SUM(CASE WHEN tx.amount > 0 THEN tx.amount ELSE 0 END), 0)',
          'issued',
        )
        .addSelect(
          'COALESCE(SUM(CASE WHEN tx.amount < 0 THEN -tx.amount ELSE 0 END), 0)',
          'spent',
        )
        .addSelect('COALESCE(SUM(tx.amount), 0)', 'net')
        .getRawOne<{ issued: string; spent: string; net: string }>(),
      qb
        .select('tx.id', 'id')
        .addSelect('tx.userId', 'userId')
        .addSelect('user.email', 'userEmail')
        .addSelect('tx.amount', 'amount')
        .addSelect('tx.reason', 'reason')
        .addSelect('tx.createdAt', 'createdAt')
        .orderBy('tx.createdAt', 'DESC')
        .limit(params.limit)
        .offset(params.offset)
        .getRawMany(),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })),
      total,
      summary: {
        issued: Number(summaryRow?.issued ?? 0),
        spent: Number(summaryRow?.spent ?? 0),
        net: Number(summaryRow?.net ?? 0),
      },
    };
  }

  async listGenerations(params: {
    status?: GenerationStatus;
    userId?: string;
    search?: string;
    type?: string;
    provider?: string;
    model?: string;
    quality?: string;
    size?: string;
    resolution?: string;
    hasReference?: boolean;
    onlyDeleted?: boolean;
    // When true, redacts free-text/image fields (prompt, result & reference
    // image URLs) from the response. Used as a fallback for admin rows whose
    // normal payload gets blocked by an upstream content filter (NetFree 418),
    // so the row can still be listed with its metadata.
    safe?: boolean;
    limit: number;
    offset: number;
  }) {
    const qb = this.generationsRepo
      .createQueryBuilder('g')
      .withDeleted()
      .leftJoin('g.user', 'user');

    if (params.onlyDeleted) {
      qb.andWhere('g.deletedAt IS NOT NULL');
    }

    if (params.status) {
      qb.andWhere('g.status = :status', { status: params.status });
    }

    if (params.userId) {
      qb.andWhere('g.userId = :userId', { userId: params.userId });
    }

    if (params.type) {
      qb.andWhere('g.type = :type', { type: params.type });
    }

    if (params.provider) {
      qb.andWhere('g.provider = :provider', { provider: params.provider });
    }

    if (params.model) {
      qb.andWhere('g.model = :model', { model: params.model });
    }

    if (params.quality) {
      qb.andWhere('g.quality = :quality', { quality: params.quality });
    }

    if (params.size) {
      qb.andWhere('g.size = :size', { size: params.size });
    }

    if (params.resolution) {
      qb.andWhere('g.resolution = :resolution', {
        resolution: params.resolution,
      });
    }

    if (params.hasReference === true) {
      qb.andWhere(
        'g."referenceImageUrls" IS NOT NULL AND jsonb_array_length(g."referenceImageUrls") > 0',
      );
    }

    if (params.hasReference === false) {
      qb.andWhere(
        '(g."referenceImageUrls" IS NULL OR jsonb_array_length(g."referenceImageUrls") = 0)',
      );
    }

    if (params.search) {
      qb.andWhere('(g.prompt ILIKE :search OR user.email ILIKE :search)', {
        search: `%${params.search}%`,
      });
    }

    const total = await qb.clone().getCount();
    const items = await qb
      .select('g.id', 'id')
      .addSelect('g.userId', 'userId')
      .addSelect('user.email', 'userEmail')
      .addSelect('g.type', 'type')
      .addSelect('g.prompt', 'prompt')
      .addSelect('g.model', 'model')
      .addSelect('g.status', 'status')
      .addSelect('g.resultUrl', 'resultUrl')
      .addSelect('g.referenceImageUrls', 'referenceImageUrls')
      .addSelect('g.quality', 'quality')
      .addSelect('g.size', 'size')
      .addSelect('g.resolution', 'resolution')
      .addSelect('g.provider', 'provider')
      .addSelect('g.creditCost', 'creditCost')
      .addSelect('g.pricingRuleId', 'pricingRuleId')
      .addSelect('g."actualCostUsd"::float8', 'actualCostUsd')
      .addSelect('g.tokensUsed', 'tokensUsed')
      .addSelect('g.errorMessage', 'errorMessage')
      .addSelect('g.providerErrorRaw', 'providerErrorRaw')
      .addSelect('g.createdAt', 'createdAt')
      .addSelect('g.deletedAt', 'deletedAt')
      .orderBy('g.createdAt', 'DESC')
      .addOrderBy('g.id', 'DESC')
      .limit(params.limit)
      .offset(params.offset)
      .getRawMany();

    if (params.safe) {
      const redacted = items.map((item) => ({
        ...item,
        prompt: null,
        resultUrl: null,
        referenceImageUrls: null,
        providerErrorRaw: null,
        blocked: true,
      }));
      return { items: redacted, total };
    }

    return { items, total };
  }

  async addCredits(userId: string, amount: number, reason?: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (amount < 0) {
      await this.creditsService.deductCredits(
        userId,
        Math.abs(amount),
        reason && reason !== 'admin_add' ? reason : 'admin_deduct',
      );
      return this.creditsService.getBalance(userId);
    }

    return this.creditsService.addCredits(
      userId,
      amount,
      reason || 'admin_add',
    );
  }

  async getCostStats() {
    const rows = await this.generationsRepo
      .createQueryBuilder('g')
      .withDeleted()
      .select('g.type', 'type')
      .addSelect('g.provider', 'provider')
      .addSelect('g.model', 'model')
      .addSelect('g.size', 'size')
      .addSelect('g.quality', 'quality')
      .addSelect('g.resolution', 'resolution')
      .addSelect(
        `CASE WHEN g."referenceImageUrls" IS NOT NULL AND jsonb_array_length(g."referenceImageUrls") > 0 THEN true ELSE false END`,
        'hasReference',
      )
      .addSelect('COUNT(*)::int', 'count')
      .addSelect(`SUM(g."creditCost")::int`, 'totalCredits')
      .addSelect(`ROUND(AVG(g."creditCost")::numeric, 1)`, 'avgCredits')
      .addSelect(`COALESCE(SUM(g."actualCostUsd"), 0)::float8`, 'totalCostUsd')
      .addSelect(`COALESCE(AVG(g."actualCostUsd"), 0)::float8`, 'avgCostUsd')
      .addSelect(`COUNT(g."actualCostUsd")::int`, 'costedCount')
      .addSelect(
        `COUNT(*) FILTER (WHERE g."actualCostUsd" IS NULL)::int`,
        'missingCostCount',
      )
      .addSelect(`MIN(g."actualCostUsd")::float8`, 'minCostUsd')
      .addSelect(`MAX(g."actualCostUsd")::float8`, 'maxCostUsd')
      .addSelect(
        `COALESCE(SUM(CASE WHEN g."referenceImageUrls" IS NOT NULL THEN jsonb_array_length(g."referenceImageUrls") ELSE 0 END), 0)::int`,
        'refCount',
      )
      .addSelect(
        `COALESCE(SUM((g."tokensUsed"->>'input_tokens')::int), 0)::int`,
        'totalInputTokens',
      )
      .addSelect(
        `COALESCE(SUM((g."tokensUsed"->>'output_tokens')::int), 0)::int`,
        'totalOutputTokens',
      )
      .addSelect(
        `COALESCE(SUM((g."tokensUsed"->'input_tokens_details'->>'image_tokens')::int), 0)::int`,
        'totalInputImageTokens',
      )
      .addSelect(
        `COALESCE(SUM((g."tokensUsed"->'output_tokens_details'->>'image_tokens')::int), 0)::int`,
        'totalOutputImageTokens',
      )
      .where('g.status = :status', { status: GenerationStatus.DONE })
      .groupBy('g.provider')
      .addGroupBy('g.type')
      .addGroupBy('g.model')
      .addGroupBy('g.size')
      .addGroupBy('g.quality')
      .addGroupBy('g.resolution')
      .addGroupBy('"hasReference"')
      .orderBy(`COALESCE(SUM(g."actualCostUsd"), 0)`, 'DESC')
      .getRawMany<Record<string, string>>();

    return rows.map((r) => ({
      type: r['type'],
      provider: r['provider'],
      model: r['model'],
      size: r['size'],
      quality: r['quality'],
      resolution: r['resolution'],
      hasReference: String(r['hasReference']) === 'true',
      count: Number(r['count']),
      totalCredits: Number(r['totalCredits']),
      avgCredits: Number(r['avgCredits']),
      totalCostUsd: Number(r['totalCostUsd']),
      avgCostUsd: Number(r['avgCostUsd']),
      costedCount: Number(r['costedCount']),
      missingCostCount: Number(r['missingCostCount']),
      minCostUsd: r['minCostUsd'] === null ? null : Number(r['minCostUsd']),
      maxCostUsd: r['maxCostUsd'] === null ? null : Number(r['maxCostUsd']),
      refCount: Number(r['refCount']),
      totalInputTokens: Number(r['totalInputTokens']),
      totalOutputTokens: Number(r['totalOutputTokens']),
      totalInputImageTokens: Number(r['totalInputImageTokens']),
      totalOutputImageTokens: Number(r['totalOutputImageTokens']),
    }));
  }

  async listPricingRules() {
    const rules = await this.pricingRulesRepo.find({
      order: {
        type: 'ASC',
        provider: 'ASC',
        model: 'ASC',
        isModelDefault: 'DESC',
        size: 'ASC',
        resolution: 'ASC',
        quality: 'ASC',
      },
    });

    const [byRuleId, byCombo] = await Promise.all([
      this.getPricingMetricsByRuleId(),
      this.getPricingMetricsByCombo(),
    ]);

    return rules.map((rule) => {
      const metrics = this.addMetrics(
        byRuleId.get(rule.id),
        rule.isModelDefault ? undefined : byCombo.get(this.comboKey(rule)),
      );
      const calculatedUsd = this.calculateRuleUsd(rule, false);
      // Under-pricing alert: the measured provider cost exceeds what we sell
      // for (sell price in USD). Surfaced prominently in the admin UI so the
      // operator can raise the price before losing money at scale.
      const underpriced =
        metrics.avgActualCostUsd > 0 && metrics.avgActualCostUsd > calculatedUsd;
      return {
        ...rule,
        calculatedUsd,
        calculatedCredits: this.calculateRuleCredits(rule, false),
        calculatedIls: creditsToIls(this.calculateRuleCredits(rule, false)),
        referenceCalculatedUsd: this.calculateRuleUsd(rule, true),
        referenceCalculatedCredits: this.calculateRuleCredits(rule, true),
        referenceCalculatedIls: creditsToIls(
          this.calculateRuleCredits(rule, true),
        ),
        underpriced,
        metrics,
      };
    });
  }

  async updatePricingRule(
    id: string,
    dto: UpdatePricingRuleDto,
    adminUserId?: string,
  ) {
    const rule = await this.pricingRulesRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }

    const fields: (keyof UpdatePricingRuleDto)[] = [
      'baseUsd',
      'referenceImageUsd',
      'margin',
      'creditCostOverride',
      'isActive',
    ];
    const logs: AiPricingRuleAuditLog[] = [];

    for (const field of fields) {
      if (!Object.prototype.hasOwnProperty.call(dto, field)) continue;
      const oldValue = rule[field as keyof AiPricingRule] as unknown;
      const newValue = dto[field] as unknown;
      if (String(oldValue ?? '') === String(newValue ?? '')) continue;

      (rule as unknown as Record<string, unknown>)[field] = newValue;
      logs.push(
        this.pricingAuditRepo.create({
          ruleId: rule.id,
          adminUserId: adminUserId ?? null,
          field,
          oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue),
          newValue: newValue === null || newValue === undefined ? null : String(newValue),
        }),
      );
    }

    const saved = await this.pricingRulesRepo.save(rule);
    if (logs.length > 0) {
      await this.pricingAuditRepo.save(logs);
    }
    return saved;
  }

  async getPricingRuleAuditLog(id: string) {
    const exists = await this.pricingRulesRepo.exists({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Pricing rule not found');
    }

    return this.pricingAuditRepo.find({
      where: { ruleId: id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async listPricingRuleGenerations(id: string, limit: number, offset: number) {
    const rule = await this.pricingRulesRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }

    const qb = this.generationsRepo
      .createQueryBuilder('g')
      .withDeleted()
      .leftJoin('g.user', 'user')
      .where('g.pricingRuleId = :id', { id });

    if (!rule.isModelDefault) {
      qb.orWhere(
        `(
          g."pricingRuleId" IS NULL
          AND g.type = :type
          AND g.provider = :provider
          AND g.model = :model
          AND g.size = :size
          AND g.quality = :quality
          AND g.resolution = :resolution
        )`,
        {
          type: rule.type,
          provider: rule.provider,
          model: rule.model,
          size: rule.size,
          quality: rule.quality,
          resolution: rule.resolution,
        },
      );
    }

    const total = await qb.clone().getCount();
    const items = await this.selectGenerationRows(qb)
      .orderBy('g.createdAt', 'DESC')
      .addOrderBy('g.id', 'DESC')
      .take(limit)
      .skip(offset)
      .getRawMany();

    return { items, total };
  }

  private async getCreditTotals() {
    const row = await this.creditTransactionsRepo
      .createQueryBuilder('tx')
      .select(
        "COALESCE(SUM(CASE WHEN tx.amount > 0 THEN tx.amount ELSE 0 END), 0)",
        'issued',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN tx.amount < 0 THEN -tx.amount ELSE 0 END), 0)",
        'spent',
      )
      .getRawOne<{ issued: string; spent: string }>();

    return {
      issued: Number(row?.issued ?? 0),
      spent: Number(row?.spent ?? 0),
    };
  }

  private parseDateFilter(value: string | undefined, boundary: 'start' | 'end') {
    if (!value) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}`)
      : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private selectGenerationRows(qb: SelectQueryBuilder<Generation>) {
    return qb
      .select('g.id', 'id')
      .addSelect('g.userId', 'userId')
      .addSelect('user.email', 'userEmail')
      .addSelect('g.type', 'type')
      .addSelect('g.prompt', 'prompt')
      .addSelect('g.model', 'model')
      .addSelect('g.status', 'status')
      .addSelect('g.resultUrl', 'resultUrl')
      .addSelect('g.referenceImageUrls', 'referenceImageUrls')
      .addSelect('g.quality', 'quality')
      .addSelect('g.size', 'size')
      .addSelect('g.resolution', 'resolution')
      .addSelect('g.provider', 'provider')
      .addSelect('g.creditCost', 'creditCost')
      .addSelect('g.pricingRuleId', 'pricingRuleId')
      .addSelect('g."actualCostUsd"::float8', 'actualCostUsd')
      .addSelect('g.tokensUsed', 'tokensUsed')
      .addSelect('g.errorMessage', 'errorMessage')
      .addSelect('g.providerErrorRaw', 'providerErrorRaw')
      .addSelect('g.createdAt', 'createdAt')
      .addSelect('g.deletedAt', 'deletedAt');
  }

  private async getPricingMetricsByRuleId() {
    const rows = await this.generationsRepo
      .createQueryBuilder('g')
      .withDeleted()
      .select('g.pricingRuleId', 'pricingRuleId')
      .addSelect('COUNT(*)::int', 'generationCount')
      .addSelect(
        `SUM(CASE WHEN g.status = '${GenerationStatus.DONE}' THEN 1 ELSE 0 END)::int`,
        'doneCount',
      )
      .addSelect(
        `SUM(CASE WHEN g.status = '${GenerationStatus.FAILED}' THEN 1 ELSE 0 END)::int`,
        'failedCount',
      )
      .addSelect(`COALESCE(SUM(g."creditCost"), 0)::int`, 'totalCredits')
      .addSelect(`COALESCE(AVG(g."creditCost"), 0)::float8`, 'avgCredits')
      .addSelect(`COALESCE(SUM(g."actualCostUsd"), 0)::float8`, 'totalActualCostUsd')
      .addSelect(`COALESCE(AVG(g."actualCostUsd"), 0)::float8`, 'avgActualCostUsd')
      .addSelect(`COALESCE(SUM((g."tokensUsed"->>'input_tokens')::int), 0)::int`, 'totalInputTokens')
      .addSelect(`COALESCE(SUM((g."tokensUsed"->>'output_tokens')::int), 0)::int`, 'totalOutputTokens')
      .addSelect(
        `COALESCE(SUM((g."tokensUsed"->'input_tokens_details'->>'image_tokens')::int), 0)::int`,
        'totalInputImageTokens',
      )
      .addSelect(
        `COALESCE(SUM((g."tokensUsed"->'output_tokens_details'->>'image_tokens')::int), 0)::int`,
        'totalOutputImageTokens',
      )
      .where('g.pricingRuleId IS NOT NULL')
      .groupBy('g.pricingRuleId')
      .getRawMany<Record<string, string>>();

    return this.metricRowsToMap(rows, (row) => row['pricingRuleId']);
  }

  private async getPricingMetricsByCombo() {
    const rows = await this.generationsRepo
      .createQueryBuilder('g')
      .select('g.type', 'type')
      .addSelect('g.provider', 'provider')
      .addSelect('g.model', 'model')
      .addSelect('g.size', 'size')
      .addSelect('g.quality', 'quality')
      .addSelect('g.resolution', 'resolution')
      .addSelect('COUNT(*)::int', 'generationCount')
      .addSelect(
        `SUM(CASE WHEN g.status = '${GenerationStatus.DONE}' THEN 1 ELSE 0 END)::int`,
        'doneCount',
      )
      .addSelect(
        `SUM(CASE WHEN g.status = '${GenerationStatus.FAILED}' THEN 1 ELSE 0 END)::int`,
        'failedCount',
      )
      .addSelect(`COALESCE(SUM(g."creditCost"), 0)::int`, 'totalCredits')
      .addSelect(`COALESCE(AVG(g."creditCost"), 0)::float8`, 'avgCredits')
      .addSelect(`COALESCE(SUM(g."actualCostUsd"), 0)::float8`, 'totalActualCostUsd')
      .addSelect(`COALESCE(AVG(g."actualCostUsd"), 0)::float8`, 'avgActualCostUsd')
      .addSelect(`COALESCE(SUM((g."tokensUsed"->>'input_tokens')::int), 0)::int`, 'totalInputTokens')
      .addSelect(`COALESCE(SUM((g."tokensUsed"->>'output_tokens')::int), 0)::int`, 'totalOutputTokens')
      .addSelect(
        `COALESCE(SUM((g."tokensUsed"->'input_tokens_details'->>'image_tokens')::int), 0)::int`,
        'totalInputImageTokens',
      )
      .addSelect(
        `COALESCE(SUM((g."tokensUsed"->'output_tokens_details'->>'image_tokens')::int), 0)::int`,
        'totalOutputImageTokens',
      )
      .where('g.pricingRuleId IS NULL')
      .groupBy('g.type')
      .addGroupBy('g.provider')
      .addGroupBy('g.model')
      .addGroupBy('g.size')
      .addGroupBy('g.quality')
      .addGroupBy('g.resolution')
      .getRawMany<Record<string, string>>();

    return this.metricRowsToMap(rows, (row) =>
      this.comboKey({
        type: row['type'],
        provider: row['provider'],
        model: row['model'],
        size: row['size'],
        quality: row['quality'],
        resolution: row['resolution'],
      }),
    );
  }

  private metricRowsToMap(
    rows: Record<string, string>[],
    keyFn: (row: Record<string, string>) => string | undefined,
  ) {
    const map = new Map<string, PricingMetric>();
    for (const row of rows) {
      const key = keyFn(row);
      if (!key) continue;
      const totalCredits = Number(row['totalCredits']);
      const totalActualCostUsd = Number(row['totalActualCostUsd']);
      // Credits are an ILS-denominated unit now (credit = creditValueIls), so
      // gross revenue in USD = credits * creditValueIls / usdIls.
      const { usdIls, creditValueIls } = getBillingConfig();
      const grossUsd = (totalCredits * creditValueIls) / usdIls;
      map.set(key, {
        generationCount: Number(row['generationCount']),
        doneCount: Number(row['doneCount']),
        failedCount: Number(row['failedCount']),
        totalCredits,
        avgCredits: Number(row['avgCredits']),
        totalActualCostUsd,
        avgActualCostUsd: Number(row['avgActualCostUsd']),
        estimatedGrossUsd: Math.round(grossUsd * 10000) / 10000,
        estimatedMarginUsd:
          Math.round((grossUsd - totalActualCostUsd) * 10000) / 10000,
        totalInputTokens: Number(row['totalInputTokens']),
        totalOutputTokens: Number(row['totalOutputTokens']),
        totalInputImageTokens: Number(row['totalInputImageTokens']),
        totalOutputImageTokens: Number(row['totalOutputImageTokens']),
      });
    }
    return map;
  }

  private addMetrics(
    first?: PricingMetric,
    second?: PricingMetric,
  ): PricingMetric {
    if (!first && !second) return EMPTY_PRICING_METRIC;
    const metrics = [first, second].filter(Boolean) as PricingMetric[];
    const total = metrics.reduce(
      (acc, item) => ({
        generationCount: acc.generationCount + item.generationCount,
        doneCount: acc.doneCount + item.doneCount,
        failedCount: acc.failedCount + item.failedCount,
        totalCredits: acc.totalCredits + item.totalCredits,
        avgCredits: 0,
        totalActualCostUsd: acc.totalActualCostUsd + item.totalActualCostUsd,
        avgActualCostUsd: 0,
        estimatedGrossUsd: acc.estimatedGrossUsd + item.estimatedGrossUsd,
        estimatedMarginUsd: acc.estimatedMarginUsd + item.estimatedMarginUsd,
        totalInputTokens: acc.totalInputTokens + item.totalInputTokens,
        totalOutputTokens: acc.totalOutputTokens + item.totalOutputTokens,
        totalInputImageTokens:
          acc.totalInputImageTokens + item.totalInputImageTokens,
        totalOutputImageTokens:
          acc.totalOutputImageTokens + item.totalOutputImageTokens,
      }),
      { ...EMPTY_PRICING_METRIC },
    );
    total.avgCredits =
      total.generationCount > 0 ? total.totalCredits / total.generationCount : 0;
    total.avgActualCostUsd =
      total.generationCount > 0
        ? total.totalActualCostUsd / total.generationCount
        : 0;
    return total;
  }

  private comboKey(rule: {
    type: string;
    provider: string | null;
    model: string | null;
    size: string | null;
    quality: string | null;
    resolution: string | null;
  }) {
    return [
      rule.type,
      rule.provider ?? '',
      rule.model ?? '',
      rule.size ?? '',
      rule.quality ?? '',
      rule.resolution ?? '',
    ].join('|');
  }

  private calculateRuleUsd(rule: AiPricingRule, hasReference: boolean) {
    const referenceUsd = hasReference ? rule.referenceImageUsd : 0;
    return Math.round((rule.baseUsd + referenceUsd) * rule.margin * 10000) / 10000;
  }

  private calculateRuleCredits(rule: AiPricingRule, hasReference: boolean) {
    if (rule.creditCostOverride !== null) return rule.creditCostOverride;
    return usdToCredits(this.calculateRuleUsd(rule, hasReference));
  }
}
