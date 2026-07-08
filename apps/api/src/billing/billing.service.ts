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
import { SumitService } from './sumit.service';

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

    const result = await this.sumitService.charge({
      singleUseToken,
      amountIls: order.priceIls,
      description: order.packageName,
      customer: { name: user.email, email: user.email, externalId: user.id },
      uniqueIdentifier: `order-${order.id}`,
    });

    if (!result.ok) {
      throw new BadRequestException(
        result.errorMessage || 'התשלום נדחה. נסי שוב.',
      );
    }

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

    const result = await this.sumitService.chargeSaved({
      customerId: user.sumitCustomerId,
      paymentMethodId: user.sumitPaymentMethodId,
      amountIls: order.priceIls,
      description: order.packageName,
      customer: { name: user.email, email: user.email, externalId: user.id },
      uniqueIdentifier: `order-${order.id}`,
    });

    if (!result.ok) {
      throw new BadRequestException(
        result.errorMessage || 'התשלום נדחה. נסי שוב.',
      );
    }

    return this.fulfillOrder(order, user.credits, result.paymentId);
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
}
