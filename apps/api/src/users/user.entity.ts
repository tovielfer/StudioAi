import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Generation } from '../generations/generation.entity';
import { CreditTransaction } from '../credits/credit-transaction.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ default: 25 })
  credits: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Generation, (g) => g.user)
  generations: Generation[];

  @OneToMany(() => CreditTransaction, (t) => t.user)
  creditTransactions: CreditTransaction[];
}
