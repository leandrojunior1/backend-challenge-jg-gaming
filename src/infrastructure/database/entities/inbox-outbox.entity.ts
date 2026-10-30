import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core';

@Entity({ tableName: 'inbox_messages' })
@Unique({ properties: ['consumerName', 'messageId'] })
export class InboxMessageEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string = crypto.randomUUID();

  @Property({ type: 'varchar', length: 255 })
  messageId!: string;

  @Property({ type: 'varchar', length: 100 })
  consumerName!: string;

  @Property({ type: 'varchar', length: 64 })
  payloadHash!: string;

  @Property({ type: 'timestamptz' })
  receivedAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true })
  processedAt?: Date;
}

@Entity({ tableName: 'outbox_messages' })
export class OutboxMessageEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  aggregateId!: string;

  @Property({ type: 'varchar', length: 100 })
  eventType!: string;

  @Property({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Property({ type: 'timestamptz' })
  occurredAt!: Date;

  @Property({ type: 'integer', default: 0 })
  attempts: number = 0;

  @Property({ type: 'timestamptz', nullable: true })
  @Index()
  nextAttemptAt?: Date;

  @Property({ type: 'timestamptz', nullable: true })
  @Index()
  publishedAt?: Date;
}