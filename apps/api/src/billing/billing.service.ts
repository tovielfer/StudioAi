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
import { SavedPaymentMethod } from './saved-payment-method.entity';
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
    @InjectRepository(SavedPaymentMethod)
    private readonly savedCardRepo: Repository<SavedPaymentMethod>,
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
   * When `saveCard` is true the user has explicitly opted to store the card for
   * faster future purchases; after a successful charge we persist SUMIT's
   * vaulted token (never the raw card).
   */
  async payOrder(
    userId: string,
    orderId: string,
    singleUseToken: string,
    saveCard = false,
  ) {
    const { order, user } = await this.loadPayableOrder(userId, orderId);

    const result = await this.sumitService.charge({
      singleUseToken,
      amountIls: order.priceIls,
      description: order.packageName,
      customer: { name: user.email, email: user.email, externalId: user.id },
      uniqueIdentifier: `order-${order.id}`,
    });

    const settled = await this.settlePaidOrder(order, user.credits, result);

    if (saveCard && result.customerId) {
      await this.persistSavedCard(userId, result.customerId);
    }

    return settled;
  }

  /**
   * Charges a pending order against the user's previously saved card — no
   * card details from the client. The saved token belongs to the user and the
   * citizen id comes from the stored record, so the request cannot be tampered.
   */
  async payOrderWithSavedCard(userId: string, orderId: string) {
    const saved = await this.savedCardRepo.findOne({ where: { userId } });
    if (!saved) {
      throw new BadRequestException('אין כרטיס שמור. הזיני פרטי כרטיס.');
    }

    const { order, user } = await this.loadPayableOrder(userId, orderId);

    const result = await this.sumitService.chargeSavedCard({
      savedCard: {
        cardToken: saved.cardToken,
        citizenId: saved.citizenId,
        expMonth: saved.expMonth,
        expYear: saved.expYear,
      },
      amountIls: order.priceIls,
      description: order.packageName,
      customer: { name: user.email, email: user.email, externalId: user.id },
      uniqueIdentifier: `order-${order.id}`,
    });

    return this.settlePaidOrder(order, user.credits, result);
  }

  /** The card the user has saved for one-click purchases, if any. */
  async getSavedCard(userId: string) {
    const saved = await this.savedCardRepo.findOne({ where: { userId } });
    if (!saved) return null;
    return {
      last4: saved.last4,
      brand: saved.brand,
      expMonth: saved.expMonth,
      expYear: saved.expYear,
    };
  }

  /** Forgets the saved card both locally and in SUMIT's vault. */
  async deleteSavedCard(userId: string) {
    const saved = await this.savedCardRepo.findOne({ where: { userId } });
    if (!saved) return { ok: true };
    await this.sumitService.removeSavedCard(saved.sumitCustomerId);
    await this.savedCardRepo.delete({ userId });
    return { ok: true };
  }

  private async loadPayableOrder(userId: string, orderId: string) {
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

  private async settlePaidOrder(
    order: Order,
    currentCredits: number,
    result: SumitChargeResult,
  ) {
    if (!result.ok) {
      throw new BadRequestException(
        result.errorMessage || 'התשלום נדחה. נסי שוב.',
      );
    }

    await this.creditsService.addCredits(
      order.userId,
      order.credits,
      `purchase:order:${order.id}`,
    );

    order.status = OrderStatus.APPROVED;
    order.provider = 'sumit';
    order.providerRef = result.paymentId;
    order.decidedAt = new Date();
    await this.orderRepo.save(order);

    return { order, credits: currentCredits + order.credits };
  }

  /**
   * Fetches the freshly vaulted card from SUMIT and upserts it for the user.
   * Best-effort: a failure here never fails the purchase the user already paid.
   */
  private async persistSavedCard(userId: string, sumitCustomerId: string) {
    try {
      const card = await this.sumitService.getSavedCard(sumitCustomerId);
      if (!card) {
        this.logger.warn(
          `Card save requested but SUMIT returned no vaulted method (user=${userId})`,
        );
        return;
      }

      const existing = await this.savedCardRepo.findOne({ where: { userId } });
      const entity = existing ?? this.savedCardRepo.create({ userId });
      entity.sumitCustomerId = sumitCustomerId;
      entity.cardToken = card.cardToken;
      entity.last4 = card.last4;
      entity.brand = card.brand;
      entity.expMonth = card.expMonth;
      entity.expYear = card.expYear;
      entity.citizenId = card.citizenId;
      await this.savedCardRepo.save(entity);
    } catch (err) {
      this.logger.error(
        `Failed to persist saved card (user=${userId}): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
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
