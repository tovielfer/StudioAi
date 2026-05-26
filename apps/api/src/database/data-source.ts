import { DataSource } from 'typeorm';
import { join } from 'path';
import '../config/env.loader';
import { User } from '../users/user.entity';
import { Generation } from '../generations/generation.entity';
import { CreditTransaction } from '../credits/credit-transaction.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Generation, CreditTransaction],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
});
