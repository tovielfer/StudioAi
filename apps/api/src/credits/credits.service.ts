import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditTransaction } from './credit-transaction.entity';
import { UsersService } from '../users/users.service';

/** One-time bonus granted the first time a user opens the installed app. */
export const INSTALL_REWARD_CREDITS = 40;

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(CreditTransaction)
    private readonly txRepo: Repository<CreditTransaction>,
    private readonly usersService: UsersService,
  ) {}

  async getBalance(userId: string) {
    const user = await this.usersService.findById(userId);
    return { credits: user?.credits ?? 0 };
  }

  async addCredits(userId: string, amount: number, reason: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    await this.usersService.updateCredits(userId, amount);
    await this.txRepo.save(
      this.txRepo.create({ userId, amount, reason }),
    );

    return this.getBalance(userId);
  }

  /**
   * Grants the one-time install bonus. The claim is atomic (see
   * UsersService.claimInstallReward): only the first call for a user actually
   * adds credits, so this endpoint is safe to hit on every app open. Returns
   * whether the bonus was granted this time plus the up-to-date balance.
   */
  async grantInstallReward(
    userId: string,
  ): Promise<{ granted: boolean; amount: number; credits: number }> {
    const won = await this.usersService.claimInstallReward(userId);
    if (!won) {
      const { credits } = await this.getBalance(userId);
      return { granted: false, amount: INSTALL_REWARD_CREDITS, credits };
    }

    await this.usersService.updateCredits(userId, INSTALL_REWARD_CREDITS);
    await this.txRepo.save(
      this.txRepo.create({
        userId,
        amount: INSTALL_REWARD_CREDITS,
        reason: 'install_reward',
      }),
    );

    const { credits } = await this.getBalance(userId);
    return { granted: true, amount: INSTALL_REWARD_CREDITS, credits };
  }

  async deductCredits(userId: string, amount: number, reason: string) {
    const success = await this.usersService.deductCredits(userId, amount);
    if (!success) {
      throw new BadRequestException('Insufficient credits');
    }

    await this.txRepo.save(
      this.txRepo.create({ userId, amount: -amount, reason }),
    );
  }
}
