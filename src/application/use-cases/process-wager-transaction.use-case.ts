import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { EntityManager, LockMode } from '@mikro-orm/postgresql';
import { Money } from '../../domain/money/money';
import { Wallet } from '../../domain/wallet/wallet';
import {
  WagerTransaction,
  WagerTransactionKind,
  WagerTransactionStatus,
} from '../../domain/transaction/wager-transaction';
import { WalletBalanceChanged } from '../../domain/events/wallet-balance-changed';
import { WagerTransactionProcessed } from '../../domain/events/wager-transaction-processed';
import { WagerTransactionRejected } from '../../domain/events/wager-transaction-rejected';
import { WagerTransactionPendingReference } from '../../domain/events/wager-transaction-pending-reference';
import { OutboxMessage } from '../../domain/messaging/outbox-message';
import { WalletEntity } from '../../infrastructure/database/entities/wallet.entity';
import { WagerTransactionEntity } from '../../infrastructure/database/entities/wager-transaction.entity';
import { WalletLedgerEntryEntity } from '../../infrastructure/database/entities/wallet-ledger-entry.entity';
import { OutboxMessageEntity } from '../../infrastructure/database/entities/inbox-outbox.entity';
import { InboxMessageEntity } from '../../infrastructure/database/entities/inbox-outbox.entity';

export interface ProcessWagerInput {
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  playerId: string;
  walletId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: { amount: string; currency: string };
  referenceExternalTransactionId?: string;
  sqsMessageId?: string;
}

export interface ProcessWagerOutput {
  transactionId: string;
  status: WagerTransactionStatus;
  balance: { amount: string; currency: string };
  idempotentReplay: boolean;
  failureCode?: string;
}

@Injectable()
export class ProcessWagerTransactionUseCase {
  constructor(private readonly em: EntityManager) {}

  public async execute(input: ProcessWagerInput): Promise<ProcessWagerOutput> {
    const existingEntity = await this.em.findOne(WagerTransactionEntity, {
      providerId: input.providerId,
      externalTransactionId: input.externalTransactionId,
    });

    if (existingEntity) {
      return this.replayExistingTransaction(existingEntity, input.payloadHash);
    }

    try {
      return await this.em.transactional(async (em) => {
      const walletEntity = await em.findOne(WalletEntity, input.walletId, {
        lockMode: LockMode.PESSIMISTIC_WRITE,
      });

      if (!walletEntity) {
        throw new NotFoundException(`Carteira ${input.walletId} não encontrada.`);
      }
      if (walletEntity.playerId !== input.playerId) {
        throw new NotFoundException(`Carteira ${input.walletId} não encontrada.`);
      }

      const wallet = Wallet.rehydrate({
        id: walletEntity.id,
        playerId: walletEntity.playerId,
        currency: walletEntity.currency,
        balance: Money.from({ amount: walletEntity.balanceAmount, currency: walletEntity.currency }),
        version: walletEntity.version,
        createdAt: walletEntity.createdAt,
        updatedAt: walletEntity.updatedAt,
      });

      const operationMoney = Money.from(input.money);
      const transactionId = crypto.randomUUID();

      const transaction = WagerTransaction.create({
        id: transactionId,
        providerId: input.providerId,
        externalTransactionId: input.externalTransactionId,
        idempotencyKey: input.idempotencyKey,
        payloadHash: input.payloadHash,
        walletId: input.walletId,
        playerId: input.playerId,
        roundId: input.roundId,
        gameId: input.gameId,
        kind: input.kind,
        money: operationMoney,
        referenceExternalTransactionId: input.referenceExternalTransactionId,
      });

      if (input.sqsMessageId) {
        const inbox = await em.findOne(InboxMessageEntity, {
          consumerName: 'WagerSqsConsumer',
          messageId: input.sqsMessageId,
        });
        if (inbox && inbox.processedAt) {
          return {
            transactionId: transaction.id,
            status: transaction.status,
            balance: wallet.balance.toJSON(),
            idempotentReplay: true,
          };
        }
        em.persist(
          em.create(InboxMessageEntity, {
            messageId: input.sqsMessageId,
            consumerName: 'WagerSqsConsumer',
            payloadHash: input.payloadHash,
            receivedAt: new Date(),
            processedAt: new Date(),
          }),
        );
      }

      let referenceEntity: WagerTransactionEntity | null = null;
      if (transaction.requiresReference()) {
        referenceEntity = await em.findOne(WagerTransactionEntity, {
          providerId: input.providerId,
          externalTransactionId: input.referenceExternalTransactionId,
        });

        if (!referenceEntity || referenceEntity.status !== WagerTransactionStatus.Processed) {
          transaction.markPendingReference();
          
          const pendingEvent = WagerTransactionPendingReference.create({
            aggregateId: transaction.id,
            correlationId: input.idempotencyKey,
            data: { transactionId: transaction.id, providerId: input.providerId, referenceExternalTransactionId: input.referenceExternalTransactionId! },
          });

          this.persistTransactionState(em, transaction, walletEntity);
          em.persist(em.create(OutboxMessageEntity, OutboxMessage.enqueue(pendingEvent).toJSON()));

          return {
            transactionId: transaction.id,
            status: transaction.status,
            balance: wallet.balance.toJSON(),
            idempotentReplay: false,
          };
        }
      }

      let ledgerEntryEntity: WalletLedgerEntryEntity | null = null;

      try {
        if (transaction.kind === WagerTransactionKind.Bet) {
          const ledgerEntry = wallet.debit({
            transactionId: transaction.id,
            ledgerEntryId: crypto.randomUUID(),
            amount: operationMoney,
          });
          ledgerEntryEntity = this.mapLedgerToEntity(em, ledgerEntry);
          transaction.markProcessed(undefined);

        } else if (transaction.kind === WagerTransactionKind.Win) {
          const ledgerEntry = wallet.credit({
            transactionId: transaction.id,
            ledgerEntryId: crypto.randomUUID(),
            amount: operationMoney,
          });
          ledgerEntryEntity = this.mapLedgerToEntity(em, ledgerEntry);
          transaction.markProcessed(referenceEntity?.id);

        } else if (transaction.kind === WagerTransactionKind.Loss) {
          transaction.markProcessed(undefined);

        } else if (transaction.kind === WagerTransactionKind.Refund) {
          if (referenceEntity!.kind !== WagerTransactionKind.Bet) {
            transaction.reject('REFUND_MUST_REFERENCE_BET');
          } else {
            const ledgerEntry = wallet.credit({
              transactionId: transaction.id,
              ledgerEntryId: crypto.randomUUID(),
              amount: operationMoney,
            });
            ledgerEntryEntity = this.mapLedgerToEntity(em, ledgerEntry);
            transaction.markProcessed(referenceEntity!.id);
          }

        } else if (transaction.kind === WagerTransactionKind.Rollback) {
          const refTx = WagerTransaction.rehydrate({
            ...referenceEntity!,
            money: Money.from({ amount: referenceEntity!.amount, currency: referenceEntity!.currency }),
          });

          const direction = transaction.ledgerDirectionFor(refTx);
          if (direction === 'DEBIT') {
            const ledgerEntry = wallet.debit({
              transactionId: transaction.id,
              ledgerEntryId: crypto.randomUUID(),
              amount: operationMoney,
            });
            ledgerEntryEntity = this.mapLedgerToEntity(em, ledgerEntry);
          } else {
            const ledgerEntry = wallet.credit({
              transactionId: transaction.id,
              ledgerEntryId: crypto.randomUUID(),
              amount: operationMoney,
            });
            ledgerEntryEntity = this.mapLedgerToEntity(em, ledgerEntry);
          }
          transaction.markProcessed(referenceEntity!.id);
        }
      } catch (error: any) {
        const failureCode = error.message.includes('Saldo insuficiente')
          ? 'INSUFFICIENT_FUNDS'
          : 'BUSINESS_RULE_VIOLATION';
          
        transaction.reject(failureCode);

        const rejectedEvent = WagerTransactionRejected.create({
          aggregateId: transaction.id,
          correlationId: input.idempotencyKey,
          data: { transactionId: transaction.id, reason: failureCode },
        });

        this.persistTransactionState(em, transaction, walletEntity);
        em.persist(em.create(OutboxMessageEntity, OutboxMessage.enqueue(rejectedEvent).toJSON()));

        return {
          transactionId: transaction.id,
          status: transaction.status,
          balance: wallet.balance.toJSON(),
          idempotentReplay: false,
          failureCode,
        };
      }

      if (transaction.status === WagerTransactionStatus.Processed) {
        walletEntity.balanceAmount = wallet.balance.toString();
        walletEntity.version = wallet.version;
        walletEntity.updatedAt = wallet.updatedAt;

        if (ledgerEntryEntity) {
          em.persist(ledgerEntryEntity);
        }

        const processedEvent = WagerTransactionProcessed.create({
          aggregateId: transaction.id,
          correlationId: input.idempotencyKey,
          data: { transactionId: transaction.id, kind: transaction.kind, status: transaction.status },
        });
        em.persist(em.create(OutboxMessageEntity, OutboxMessage.enqueue(processedEvent).toJSON()));

        if (ledgerEntryEntity) {
          const balanceChangedEvent = WalletBalanceChanged.create({
            aggregateId: wallet.id,
            correlationId: input.idempotencyKey,
            data: {
              walletId: wallet.id,
              transactionId: transaction.id,
              direction: ledgerEntryEntity.direction,
              money: operationMoney.toJSON(),
              balanceBefore: { amount: ledgerEntryEntity.balanceBefore, currency: wallet.currency },
              balanceAfter: { amount: ledgerEntryEntity.balanceAfter, currency: wallet.currency },
              walletVersion: wallet.version,
            },
          });
          em.persist(em.create(OutboxMessageEntity, OutboxMessage.enqueue(balanceChangedEvent).toJSON()));
        }
      }

      this.persistTransactionState(em, transaction, walletEntity);

      return {
        transactionId: transaction.id,
        status: transaction.status,
        balance: wallet.balance.toJSON(),
        idempotentReplay: false,
      };
      });
    } catch (error) {
      if (!(error instanceof UniqueConstraintViolationException)) {
        throw error;
      }

      const conflictingTransaction = await this.em.findOne(WagerTransactionEntity, {
        providerId: input.providerId,
        externalTransactionId: input.externalTransactionId,
      });
      if (!conflictingTransaction) {
        throw error;
      }

      return this.replayExistingTransaction(conflictingTransaction, input.payloadHash);
    }
  }

  private async replayExistingTransaction(
    transaction: WagerTransactionEntity,
    payloadHash: string,
  ): Promise<ProcessWagerOutput> {
    if (transaction.payloadHash !== payloadHash) {
      throw new ConflictException('Conflito de Idempotência: Chave reutilizada com payload divergente.');
    }

    const wallet = await this.em.findOneOrFail(WalletEntity, transaction.walletId);
    return {
      transactionId: transaction.id,
      status: transaction.status,
      balance: { amount: wallet.balanceAmount, currency: wallet.currency },
      idempotentReplay: true,
      failureCode: transaction.failureCode,
    };
  }

  private persistTransactionState(em: EntityManager, tx: WagerTransaction, walletEntity: WalletEntity): void {
    const txEntity = em.create(WagerTransactionEntity, {
      id: tx.id,
      providerId: tx.providerId,
      externalTransactionId: tx.externalTransactionId,
      idempotencyKey: tx.idempotencyKey,
      payloadHash: tx.payloadHash,
      walletId: tx.walletId,
      playerId: tx.playerId,
      roundId: tx.roundId,
      gameId: tx.gameId,
      kind: tx.kind,
      status: tx.status,
      amount: tx.money.toString(),
      currency: tx.money.currency,
      referenceExternalTransactionId: tx.referenceExternalTransactionId,
      referenceTransactionId: tx.referenceTransactionId,
      failureCode: tx.failureCode,
      createdAt: tx.createdAt,
      processedAt: tx.processedAt,
    });
    em.persist(txEntity);
  }

  private mapLedgerToEntity(em: EntityManager, entry: any): WalletLedgerEntryEntity {
    return em.create(WalletLedgerEntryEntity, {
      id: entry.id,
      walletId: entry.walletId,
      transactionId: entry.transactionId,
      direction: entry.direction,
      amount: entry.money.toString(),
      balanceBefore: entry.balanceBefore.toString(),
      balanceAfter: entry.balanceAfter.toString(),
      createdAt: entry.createdAt,
    });
  }
}