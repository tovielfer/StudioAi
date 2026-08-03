import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, CreditTransaction])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
