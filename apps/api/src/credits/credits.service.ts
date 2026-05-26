import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditTransaction } from './credit-transaction.entity';
import { UsersService } from '../users/users.service';

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
