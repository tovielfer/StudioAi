import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { CreditsService } from '../credits/credits.service';
import { Generation } from '../generations/generation.entity';
import { GenerationStatus } from '../common/constants';
import { User } from '../users/user.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Generation)
    private readonly generationsRepo: Repository<Generation>,
    @InjectRepository(CreditTransaction)
    private readonly creditTransactionsRepo: Repository<CreditTransaction>,
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

  async listGenerations(params: {
    status?: GenerationStatus;
    userId?: string;
    search?: string;
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
      .addSelect('g.referenceImageUrl', 'referenceImageUrl')
      .addSelect('g.quality', 'quality')
      .addSelect('g.size', 'size')
      .addSelect('g.provider', 'provider')
      .addSelect('g.creditCost', 'creditCost')
      .addSelect('g.errorMessage', 'errorMessage')
      .addSelect('g.createdAt', 'createdAt')
      .orderBy('g.createdAt', 'DESC')
      .take(params.limit)
      .skip(params.offset)
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
}
