import { Injectable, ConflictException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Wallet } from '../../domain/wallet/wallet';
import { Money } from '../../domain/money/money';
import { WagerTransactionKind, WagerTransactionStatus } from '../../domain/transaction/wager-transaction';
import { WalletEntity } from '../../infrastructure/database/entities/wallet.entity';
import { WalletLedgerEntryEntity } from '../../infrastructure/database/entities/wallet-ledger-entry.entity';
import { WagerTransactionEntity } from '../../infrastructure/database/entities/wager-transaction.entity';
import { LedgerDirection } from '../../domain/wallet/wallet-ledger';

@Injectable()
export class CreateWalletUseCase {
  constructor(private readonly em: EntityManager) {}

  public async execute(input: { playerId: string; initialBalance: { amount: string; currency: string } }) {
    const initialMoney = Money.from(input.initialBalance);

    return await this.em.transactional(async (em) => {
      const existing = await em.findOne(WalletEntity, { playerId: input.playerId, currency: initialMoney.currency });
      if (existing) {
        throw new ConflictException(`Carteira já existente para o jogador ${input.playerId} com moeda ${initialMoney.currency}`);
      }

      const walletId = crypto.randomUUID();
      const wallet = Wallet.open({ id: walletId, playerId: input.playerId, initialBalance: initialMoney });

      const walletEntity = em.create(WalletEntity, {
        id: wallet.id,
        playerId: wallet.playerId,
        currency: wallet.currency,
        balanceAmount: wallet.balance.toString(),
        version: wallet.version,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      });
      em.persist(walletEntity);

      if (initialMoney.isPositive()) {
        const txId = crypto.randomUUID();
        const txEntity = em.create(WagerTransactionEntity, {
          id: txId,
          providerId: 'INTERNAL',
          externalTransactionId: `OPENING-${wallet.id}`,
          idempotencyKey: `OPENING-${wallet.id}`,
          payloadHash: 'INTERNAL',
          walletId: wallet.id,
          playerId: wallet.playerId,
          roundId: 'INTERNAL',
          gameId: 'INTERNAL',
          kind: WagerTransactionKind.Opening,
          status: WagerTransactionStatus.Processed,
          amount: initialMoney.toString(),
          currency: initialMoney.currency,
          createdAt: wallet.createdAt,
          processedAt: wallet.createdAt,
        });

        const ledgerEntity = em.create(WalletLedgerEntryEntity, {
          id: crypto.randomUUID(),
          walletId: wallet.id,
          transactionId: txId,
          direction: LedgerDirection.Credit,
          amount: initialMoney.toString(),
          balanceBefore: '0.00',
          balanceAfter: initialMoney.toString(),
          createdAt: wallet.createdAt,
        });

        em.persist(txEntity);
        em.persist(ledgerEntity);
      }

      return {
        id: wallet.id,
        playerId: wallet.playerId,
        balance: wallet.balance.toJSON(),
        version: wallet.version,
      };
    });
  }
}