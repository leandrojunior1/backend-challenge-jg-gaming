import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntityManager } from '@mikro-orm/postgresql';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { OutboxMessageEntity } from '../database/entities/inbox-outbox.entity';

@Injectable()
export class OutboxPublisherWorker {
  private readonly logger = new Logger(OutboxPublisherWorker.name);
  private readonly sqs = new SQSClient({ endpoint: process.env.SQS_ENDPOINT || 'http://localhost:4566', region: 'us-east-1' });

  constructor(private readonly em: EntityManager) {}

  @Cron(CronExpression.EVERY_SECOND)
  public async publishPendingEvents() {
    const fork = this.em.fork();
    const now = new Date();

    const pendingMessages = await fork.find(OutboxMessageEntity, {
      publishedAt: null,
      $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
    }, { limit: 20 });

    for (const msg of pendingMessages) {
      try {
        await this.sqs.send(new SendMessageCommand({
          QueueUrl: process.env.SQS_EVENTS_QUEUE_URL,
          MessageBody: JSON.stringify(msg.payload),
          MessageGroupId: msg.aggregateId,
          MessageDeduplicationId: msg.id,
        }));

        msg.publishedAt = new Date();
        await fork.flush();
      } catch (err: any) {
        this.logger.error(`Erro ao publicar outbox ${msg.id}: ${err.message}`);
        msg.attempts += 1;
        msg.nextAttemptAt = new Date(Date.now() + Math.pow(2, msg.attempts) * 1000);
        await fork.flush();
      }
    }
  }
}