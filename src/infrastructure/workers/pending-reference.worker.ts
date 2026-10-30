import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntityManager } from '@mikro-orm/postgresql';
import { ProcessWagerTransactionUseCase } from '../../application/use-cases/process-wager-transaction.use-case';
import { WagerTransactionEntity } from '../database/entities/wager-transaction.entity';
import { WagerTransactionStatus } from '../../domain/transaction/wager-transaction';
import { OutboxMessageEntity } from '../database/entities/inbox-outbox.entity';
import { OutboxMessage } from '../../domain/messaging/outbox-message';
import { WagerTransactionRejected } from '../../domain/events/wager-transaction-rejected';

@Injectable()
export class PendingReferenceWorker {
  private readonly logger = new Logger(PendingReferenceWorker.name);

  constructor(
    private readonly em: EntityManager,
    private readonly processWagerUseCase: ProcessWagerTransactionUseCase,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  public async reprocessPendingReferences() {
    const fork = this.em.fork();
    
    const pendingTxs = await fork.find(WagerTransactionEntity, {
      status: WagerTransactionStatus.PendingReference,
    }, { limit: 50 });

    for (const tx of pendingTxs) {
      const refTx = await fork.findOne(WagerTransactionEntity, {
        providerId: tx.providerId,
        externalTransactionId: tx.referenceExternalTransactionId,
      });

      if (refTx && refTx.status === WagerTransactionStatus.Processed) {
        this.logger.log(`Reprocessando transação ${tx.id} - referência ${tx.referenceExternalTransactionId} encontrada.`);
        
        await this.processWagerUseCase.execute({
          providerId: tx.providerId,
          externalTransactionId: tx.externalTransactionId,
          idempotencyKey: tx.idempotencyKey,
          payloadHash: tx.payloadHash,
          playerId: tx.playerId,
          walletId: tx.walletId,
          roundId: tx.roundId,
          gameId: tx.gameId,
          kind: tx.kind,
          money: { amount: tx.amount, currency: tx.currency },
          referenceExternalTransactionId: tx.referenceExternalTransactionId,
        });
      } else {
        const createdAtTime = new Date(tx.createdAt).getTime();
        const isExpired = Date.now() - createdAtTime > 24 * 60 * 60 * 1000;

        if (isExpired) {
          tx.status = WagerTransactionStatus.Rejected;
          tx.failureCode = 'REFERENCE_NOT_FOUND';
          
          const rejectedEvent = WagerTransactionRejected.create({
            aggregateId: tx.id,
            correlationId: tx.idempotencyKey,
            data: { transactionId: tx.id, reason: 'REFERENCE_NOT_FOUND' },
          });

          fork.persist(fork.create(OutboxMessageEntity, OutboxMessage.enqueue(rejectedEvent).toJSON()));
          await fork.flush();
        }
      }
    }
  }
}