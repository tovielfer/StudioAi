import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, SelectQueryBuilder } from 'typeorm';
import { AiPricingRuleAuditLog } from '../ai/ai-pricing-rule-audit-log.entity';
import { AiPricingRule } from '../ai/ai-pricing-rule.entity';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { CreditsService } from '../credits/credits.service';
import { Generation } from '../generations/generation.entity';
import { GenerationStatus } from '../common/constants';
import { creditsToIls, getBillingConfig, usdToCredits } from '../config/billing';
import { User } from '../users/user.entity';
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
  ) {}

  async getStats() {
    const [usersTotal, generationsTotal, creditTotals, statusRows] =
      await Promise.all([
        this.usersRepo.count(),
        this.generationsRepo.count(),
        this.getCreditTotals(),
        this.generationsRepo
          .createQueryBuilder('g')
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

  async listUsers(params: { search?: string; limit: number; offset: number }) {
    const [items, total] = await this.usersRepo.findAndCount({
      select: {
        id: true,
        email: true,
        credits: true,
        role: true,
        createdAt: true,
      },
      where: params.search ? { email: ILike(`%${params.search}%`) } : {},
      order: { createdAt: 'DESC' },
      take: params.limit,
      skip: params.offset,
    });

    return { items, total };
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
    limit: number;
    offset: number;
  }) {
    const qb = this.generationsRepo
      .createQueryBuilder('g')
      .leftJoin('g.user', 'user');

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
      .orderBy('g.createdAt', 'DESC')
      .limit(params.limit)
      .offset(params.offset)
      .getRawMany();

    return { items, total };
  }

  async addCredits(userId: string, amount: number, reason?: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
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
      .addSelect('g.createdAt', 'createdAt');
  }

  private async getPricingMetricsByRuleId() {
    const rows = await this.generationsRepo
      .createQueryBuilder('g')
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
