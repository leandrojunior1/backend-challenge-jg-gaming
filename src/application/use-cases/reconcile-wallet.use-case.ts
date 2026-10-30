import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { WalletEntity } from '../../infrastructure/database/entities/wallet.entity';
import { WalletLedgerEntryEntity } from '../../infrastructure/database/entities/wallet-ledger-entry.entity';
import { Money } from '../../domain/money/money';

@Injectable()
export class ReconcileWalletUseCase {
  constructor(private readonly em: EntityManager) {}

  public async execute(walletId: string) {
    const wallet = await this.em.findOne(WalletEntity, walletId);
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} não encontrada.`);

    const entries = await this.em.find(WalletLedgerEntryEntity, { walletId }, { orderBy: { createdAt: 'ASC' } });

    let calculated = Money.zero(wallet.currency);
    for (const entry of entries) {
      const amount = Money.from({ amount: entry.amount, currency: wallet.currency });
      if (entry.direction === 'CREDIT') {
        calculated = calculated.add(amount);
      } else {
        calculated = calculated.subtract(amount);
      }
    }

    const stored = Money.from({ amount: wallet.balanceAmount, currency: wallet.currency });
    const consistent = stored.equals(calculated);
    const difference = stored.subtract(calculated);

    return {
      walletId: wallet.id,
      storedBalance: stored.toJSON(),
      calculatedBalance: calculated.toJSON(),
      difference: difference.toJSON(),
      consistent,
      checkedEntries: entries.length,
    };
  }
}