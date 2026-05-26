import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.usersRepo.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }

  create(email: string, passwordHash: string) {
    const user = this.usersRepo.create({ email, passwordHash, credits: 25 });
    return this.usersRepo.save(user);
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
