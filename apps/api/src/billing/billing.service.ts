import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditsService } from '../credits/credits.service';
import { UsersService } from '../users/users.service';
import { CreditPackage } from './credit-package.entity';
import { CreatePackageDto, UpdatePackageDto } from './dto/package.dto';
import { Order, OrderStatus } from './order.entity';
import { SumitChargeResult, SumitService } from './sumit.service';

/**
 * Default packs. The largest pack is the target rate (100 credits / ILS, i.e.
 * credit = ILS 0.01); smaller packs grant fewer credits per shekel.
 */
const DEFAULT_PACKAGES: Array<
  Pick<CreditPackage, 'name' | 'priceIls' | 'credits' | 'badge' | 'sortOrder'>
> = [
  { name: 'התחלה', priceIls: 25, credits: 2000, badge: null, sortOrder: 1 },
  { name: 'בסיסי', priceIls: 60, credits: 5400, badge: null, sortOrder: 2 },
  { name: 'פלוס', priceIls: 120, credits: 11400, badge: null, sortOrder: 3 },
  {
    name: 'מקצועי',
    priceIls: 250,
    credits: 25000,
    badge: 'הכי משתלם',
    sortOrder: 4,
  },
];

@Injectable()
export class BillingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(CreditPackage)
    private readonly packageRepo: Repository<CreditPackage>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly creditsService: CreditsService,
    private readonly usersService: UsersService,
    private readonly sumitService: SumitService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const count = await this.packageRepo.count();
      if (count === 0) {
        await this.packageRepo.save(
          DEFAULT_PACKAGES.map((pkg) =>
            this.packageRepo.create({ ...pkg, isActive: true }),
          ),
        );
        this.logger.log(`Seeded ${DEFAULT_PACKAGES.length} default packages`);
      }
    } catch (err) {
      this.logger.error(
        `Package seeding failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // --- Packages (public) ---

  listActivePackages() {
    return this.packageRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', priceIls: 'ASC' },
    });
  }

  // --- Packages (admin) ---

  listAllPackages() {
    return this.packageRepo.find({
      order: { sortOrder: 'ASC', priceIls: 'ASC' },
    });
  }

  createPackage(dto: CreatePackageDto) {
    const pkg = this.packageRepo.create({
      name: dto.name,
      priceIls: dto.priceIls,
      credits: dto.credits,
      badge: dto.badge ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.packageRepo.save(pkg);
  }

  async updatePackage(id: string, dto: UpdatePackageDto) {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    Object.assign(pkg, dto);
    return this.packageRepo.save(pkg);
  }

  // --- Orders (user) ---

  async createOrder(userId: string, packageId: string, note?: string) {
    const pkg = await this.packageRepo.findOne({
      where: { id: packageId, isActive: true },
    });
    if (!pkg) throw new NotFoundException('Package not found');

    const order = this.orderRepo.create({
      userId,
      packageId: pkg.id,
      packageName: pkg.name,
      priceIls: pkg.priceIls,
      credits: pkg.credits,
      status: OrderStatus.PENDING,
      note: note ?? null,
    });
    return this.orderRepo.save(order);
  }

  listMyOrders(userId: string) {
    return this.orderRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /**
   * Charges a pending order via SUMIT using a single-use card token created in
   * the browser. On success the order is marked approved and the credits are
   * granted immediately — replacing the manual admin approval for paid orders.
   *
   * The amount and credit grant are always taken from the persisted order, never
   * from the client, so a tampered request cannot change what is charged.
   *
   * When `saveCard` is set (default), the SUMIT customer + payment-method token
   * returned by the charge are stored on the user so the card can be charged
   * again later without re-entering details.
   */
  async payOrder(
    userId: string,
    orderId: string,
    singleUseToken: string,
    saveCard = true,
  ) {
    const { order, user } = await this.loadPendingOrder(userId, orderId);

    const result = await this.chargeOrRecordFailure(order, () =>
      this.sumitService.charge({
        singleUseToken,
        amountIls: order.priceIls,
        description: order.packageName,
        customer: { name: user.email, email: user.email, externalId: user.id },
        uniqueIdentifier: `order-${order.id}`,
      }),
    );

    if (saveCard && result.customerId && result.paymentMethodId) {
      await this.usersService.saveSumitPaymentMethod(user.id, {
        customerId: result.customerId,
        paymentMethodId: result.paymentMethodId,
        cardLast4: result.cardLast4,
        cardBrand: result.cardBrand,
      });
    }

    return this.fulfillOrder(order, user.credits, result.paymentId);
  }

  /**
   * Charges a pending order against the card previously saved for this user
   * (SUMIT CustomerID + PaymentMethodID). No card details are needed from the
   * client — the amount and credits still come from the persisted order.
   */
  async payOrderWithSavedCard(userId: string, orderId: string) {
    const { order, user } = await this.loadPendingOrder(userId, orderId);

    if (!user.sumitCustomerId || !user.sumitPaymentMethodId) {
      throw new BadRequestException('אין כרטיס שמור. יש להזין פרטי תשלום.');
    }

    const result = await this.chargeOrRecordFailure(order, () =>
      this.sumitService.chargeSaved({
        customerId: user.sumitCustomerId!,
        paymentMethodId: user.sumitPaymentMethodId!,
        amountIls: order.priceIls,
        description: order.packageName,
        customer: { name: user.email, email: user.email, externalId: user.id },
        uniqueIdentifier: `order-${order.id}`,
      }),
    );

    return this.fulfillOrder(order, user.credits, result.paymentId);
  }

  /**
   * Runs a charge and, on a declined/errored payment, marks the order `failed`
   * with the gateway message before rethrowing. This keeps a permanent record
   * of *why* a purchase did not complete, so the admin can see the error
   * instead of a silent `pending` row.
   */
  private async chargeOrRecordFailure(
    order: Order,
    charge: () => Promise<SumitChargeResult>,
  ) {
    let result: SumitChargeResult;
    try {
      result = await charge();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'שגיאת תקשורת מול חברת הסליקה';
      await this.recordFailedCharge(order, message);
      throw err;
    }

    if (!result.ok) {
      const message = result.errorMessage || 'התשלום נדחה. נסי שוב.';
      await this.recordFailedCharge(order, message);
      throw new BadRequestException(message);
    }

    return result;
  }

  private async recordFailedCharge(order: Order, message: string) {
    order.status = OrderStatus.FAILED;
    order.failureReason = message.slice(0, 500);
    order.failedAt = new Date();
    order.provider = 'sumit';
    await this.orderRepo.save(order);
  }

  /** Forgets the user's saved card so it is no longer offered/charged. */
  async removeSavedCard(userId: string) {
    await this.usersService.clearSumitPaymentMethod(userId);
    return { ok: true };
  }

  /** Loads a pending order owned by the user, plus the user, or throws. */
  private async loadPendingOrder(userId: string, orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not pending');
    }

    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    return { order, user };
  }

  /** Grants the order credits and marks it approved after a successful charge. */
  private async fulfillOrder(
    order: Order,
    creditsBefore: number,
    paymentId: string | null,
  ) {
    await this.creditsService.addCredits(
      order.userId,
      order.credits,
      `purchase:order:${order.id}`,
    );

    order.status = OrderStatus.APPROVED;
    order.provider = 'sumit';
    order.providerRef = paymentId;
    order.decidedAt = new Date();
    await this.orderRepo.save(order);

    return { order, credits: creditsBefore + order.credits };
  }

  // --- Orders (admin) ---

  async listOrders(status?: OrderStatus) {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.user', 'user')
      .select('o.id', 'id')
      .addSelect('o.userId', 'userId')
      .addSelect('user.email', 'userEmail')
      .addSelect('o.packageId', 'packageId')
      .addSelect('o.packageName', 'packageName')
      .addSelect('o."priceIls"::float8', 'priceIls')
      .addSelect('o.credits', 'credits')
      .addSelect('o.status', 'status')
      .addSelect('o.note', 'note')
      .addSelect('o.failureReason', 'failureReason')
      .addSelect('o.failedAt', 'failedAt')
      .addSelect('o.decidedByUserId', 'decidedByUserId')
      .addSelect('o.decidedAt', 'decidedAt')
      .addSelect('o.createdAt', 'createdAt')
      .orderBy('o.createdAt', 'DESC')
      .limit(200);

    if (status) {
      qb.where('o.status = :status', { status });
    }

    return qb.getRawMany();
  }

  async approveOrder(orderId: string, adminUserId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not pending');
    }

    await this.creditsService.addCredits(
      order.userId,
      order.credits,
      `purchase:order:${order.id}`,
    );

    order.status = OrderStatus.APPROVED;
    order.decidedByUserId = adminUserId;
    order.decidedAt = new Date();
    return this.orderRepo.save(order);
  }

  async rejectOrder(orderId: string, adminUserId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not pending');
    }

    order.status = OrderStatus.REJECTED;
    order.decidedByUserId = adminUserId;
    order.decidedAt = new Date();
    return this.orderRepo.save(order);
  }

  async countPendingOrders() {
    return this.orderRepo.count({ where: { status: OrderStatus.PENDING } });
  }

  /** Count of successful purchases the admin has not opened the page for yet. */
  async countNewApprovedOrders() {
    return this.orderRepo.count({
      where: { status: OrderStatus.APPROVED, seenByAdmin: false },
    });
  }

  /** Marks all successful purchases as seen (clears the admin nav badge). */
  async markApprovedOrdersSeen() {
    await this.orderRepo.update(
      { status: OrderStatus.APPROVED, seenByAdmin: false },
      { seenByAdmin: true },
    );
    return { ok: true };
  }

  /**
   * Revenue summary for the admin dashboard: all-time totals plus a per-day
   * revenue series for the last `days` days (approved orders only, keyed on the
   * date the payment went through).
   */
  async getOrdersSummary(days = 30) {
    const safeDays = Math.min(Math.max(Math.floor(days) || 30, 1), 365);

    const totals = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o."priceIls"), 0)::float8', 'revenue')
      .addSelect('COUNT(*)::int', 'count')
      .where('o.status = :status', { status: OrderStatus.APPROVED })
      .getRawOne<{ revenue: number; count: number }>();

    const totalRevenue = Number(totals?.revenue ?? 0);
    const totalOrders = Number(totals?.count ?? 0);

    const from = new Date();
    from.setHours(0, 0, 0, 0);
    // Subtract an extra day so the earliest visible day is fully covered even
    // though the window boundary is an absolute instant rather than an
    // Israel-local midnight (the frontend only reads the days it renders).
    from.setDate(from.getDate() - safeDays);

    // Bucket by Israel calendar day (not the DB session timezone, which is
    // typically UTC). This must match the day key the admin UI uses so the
    // per-day totals and the click-to-drill breakdown line up.
    const dateExpr = `date_trunc('day', COALESCE(o."decidedAt", o."createdAt") AT TIME ZONE 'Asia/Jerusalem')`;
    const series = await this.orderRepo
      .createQueryBuilder('o')
      .select(`to_char(${dateExpr}, 'YYYY-MM-DD')`, 'date')
      .addSelect('COALESCE(SUM(o."priceIls"), 0)::float8', 'revenue')
      .addSelect('COUNT(*)::int', 'count')
      .where('o.status = :status', { status: OrderStatus.APPROVED })
      .andWhere('COALESCE(o."decidedAt", o."createdAt") >= :from', { from })
      .groupBy(dateExpr)
      .orderBy(dateExpr, 'ASC')
      .getRawMany<{ date: string; revenue: number; count: number }>();

    return {
      totalRevenue,
      totalOrders,
      avgOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      days: safeDays,
      series: series.map((row) => ({
        date: row.date,
        revenue: Number(row.revenue),
        count: Number(row.count),
      })),
    };
  }
}
