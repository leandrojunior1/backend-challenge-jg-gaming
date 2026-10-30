import { Check, Entity, PrimaryKey, Property, Enum, Unique, Index } from '@mikro-orm/core';
import { WagerTransactionKind, WagerTransactionStatus } from '../../../domain/transaction/wager-transaction';

@Entity({ tableName: 'wager_transactions' })
@Unique({ properties: ['providerId', 'externalTransactionId'] })
@Check({ name: 'wager_transactions_check', expression: 'amount > 0' })
export class WagerTransactionEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'varchar', length: 100 })
  providerId!: string;

  @Property({ type: 'varchar', length: 150 })
  externalTransactionId!: string;

  @Property({ type: 'varchar', length: 255 })
  @Index()
  idempotencyKey!: string;

  @Property({ type: 'varchar', length: 64 })
  payloadHash!: string;

  @Property({ type: 'uuid' })
  @Index()
  walletId!: string;

  @Property({ type: 'uuid' })
  playerId!: string;

  @Property({ type: 'varchar', length: 150 })
  roundId!: string;

  @Property({ type: 'varchar', length: 150 })
  gameId!: string;

  @Enum({ items: () => WagerTransactionKind, nativeEnumName: 'wager_transactions_kind_enum' })
  kind!: WagerTransactionKind;

  @Enum({ items: () => WagerTransactionStatus, nativeEnumName: 'wager_transactions_status_enum' })
  @Index()
  status!: WagerTransactionStatus;

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string;

  @Property({ type: 'varchar', length: 3 })
  currency!: string;

  @Property({ type: 'varchar', length: 150, nullable: true })
  referenceExternalTransactionId?: string;

  @Property({ type: 'uuid', nullable: true })
  referenceTransactionId?: string;

  @Property({ type: 'varchar', length: 100, nullable: true })
  failureCode?: string;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true })
  processedAt?: Date;
}