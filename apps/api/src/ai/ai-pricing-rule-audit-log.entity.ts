import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_pricing_rule_audit_logs')
export class AiPricingRuleAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ruleId: string;

  @Column({ type: 'uuid', nullable: true })
  adminUserId: string | null;

  @Column({ type: 'varchar' })
  field: string;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
