import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { ProcessWagerTransactionUseCase } from '../../application/use-cases/process-wager-transaction.use-case';
import * as crypto from 'crypto';

@Injectable()
export class WagerSqsConsumer implements OnModuleInit {
  private readonly logger = new Logger(WagerSqsConsumer.name);
  private readonly sqs = new SQSClient({ endpoint: process.env.SQS_ENDPOINT || 'http://localhost:4566', region: 'us-east-1' });

  constructor(private readonly processWagerUseCase: ProcessWagerTransactionUseCase) {}

  onModuleInit() {
    this.pollMessages();
  }

  private async pollMessages() {
    while (true) {
      try {
        const response = await this.sqs.send(new ReceiveMessageCommand({
          QueueUrl: process.env.SQS_WAGER_QUEUE_URL,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 10,
        }));

        if (response.Messages) {
          for (const msg of response.Messages) {
            const body = JSON.parse(msg.Body!);
            const data = body.data;

            await this.processWagerUseCase.execute({
              providerId: data.providerId,
              externalTransactionId: data.externalTransactionId,
              idempotencyKey: data.idempotencyKey,
              payloadHash: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),
              playerId: data.playerId,
              walletId: data.walletId,
              roundId: data.roundId,
              gameId: data.gameId,
              kind: data.kind,
              money: data.money,
              referenceExternalTransactionId: data.referenceExternalTransactionId,
              sqsMessageId: msg.MessageId,
            });

            await this.sqs.send(new DeleteMessageCommand({
              QueueUrl: process.env.SQS_WAGER_QUEUE_URL,
              ReceiptHandle: msg.ReceiptHandle,
            }));
          }
        }
      } catch (err: any) {
        this.logger.error(`Erro no processamento de SQS: ${err.message}`);
      }
    }
  }
}