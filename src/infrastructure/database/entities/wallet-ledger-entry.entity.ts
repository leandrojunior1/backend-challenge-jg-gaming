import { Check, Entity, PrimaryKey, Property, Enum, Index } from '@mikro-orm/core';
import { LedgerDirection } from '../../../domain/wallet/wallet-ledger';

@Entity({ tableName: 'wallet_ledger_entries' })
@Check({
  name: 'wallet_ledger_entries_check',
  expression: 'amount > 0 AND balance_before >= 0 AND balance_after >= 0',
})
export class WalletLedgerEntryEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  @Index()
  walletId!: string;

  @Property({ type: 'uuid' })
  @Index()
  transactionId!: string;

  @Enum({ items: () => LedgerDirection, nativeEnumName: 'wallet_ledger_entries_direction_enum' })
  direction!: LedgerDirection;

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string;

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  balanceBefore!: string;

  @Property({ type: 'numeric', precision: 18, scale: 2 })
  balanceAfter!: string;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();
}