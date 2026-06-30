import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { User } from './user.entity';

/** Credits granted to a new account on signup. */
export const SIGNUP_BONUS_CREDITS = 150;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(CreditTransaction)
    private readonly creditTxRepo: Repository<CreditTransaction>,
  ) {}

  findByEmail(email: string) {
    const normalizedEmail = normalizeEmail(email);
    return this.usersRepo.findOne({
      where: {
        email: Raw((alias) => `LOWER(TRIM(${alias})) = :email`, {
          email: normalizedEmail,
        }),
      },
    });
  }

  findById(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }

  findByEmailVerificationToken(token: string) {
    return this.usersRepo.findOne({ where: { emailVerificationToken: token } });
  }

  findByResetPasswordToken(token: string) {
    return this.usersRepo.findOne({ where: { resetPasswordToken: token } });
  }

  async create(
    email: string,
    passwordHash: string,
    opts?: { emailVerificationToken?: string; emailVerificationExpiry?: Date },
  ) {
    const normalizedEmail = normalizeEmail(email);
    const user = this.usersRepo.create({
      email: normalizedEmail,
      passwordHash,
      credits: SIGNUP_BONUS_CREDITS,
      emailVerified: false,
      emailVerificationToken: opts?.emailVerificationToken ?? null,
      emailVerificationExpiry: opts?.emailVerificationExpiry ?? null,
    });
    const saved = await this.usersRepo.save(user);

    // Record the signup grant in the ledger so balances are fully auditable.
    await this.creditTxRepo.save(
      this.creditTxRepo.create({
        userId: saved.id,
        amount: SIGNUP_BONUS_CREDITS,
        reason: 'signup_bonus',
      }),
    );

    return saved;
  }

  async markEmailVerified(userId: string) {
    await this.usersRepo.update(userId, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    });
  }

  async setResetPasswordToken(
    userId: string,
    token: string,
    expiry: Date,
  ) {
    await this.usersRepo.update(userId, {
      resetPasswordToken: token,
      resetPasswordExpiry: expiry,
    });
  }

  async resetPassword(userId: string, passwordHash: string) {
    await this.usersRepo.update(userId, {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
    });
  }

  async updateCredits(userId: string, amount: number) {
    await this.usersRepo.increment({ id: userId }, 'credits', amount);
    return this.findById(userId);
  }

  async deductCredits(userId: string, amount: number): Promise<boolean> {
    const result = await this.usersRepo
      .createQueryBuilder()
      .update(User)
      .set({ credits: () => `credits - ${amount}` })
      .where('id = :id AND credits >= :amount', { id: userId, amount })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
