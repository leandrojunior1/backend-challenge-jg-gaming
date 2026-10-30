import 'dotenv/config';
import { defineConfig } from '@mikro-orm/postgresql';
import { InboxMessageEntity, OutboxMessageEntity } from './infrastructure/database/entities/inbox-outbox.entity';
import { WagerTransactionEntity } from './infrastructure/database/entities/wager-transaction.entity';
import { WalletLedgerEntryEntity } from './infrastructure/database/entities/wallet-ledger-entry.entity';
import { WalletEntity } from './infrastructure/database/entities/wallet.entity';

export default defineConfig({
  dbName: process.env.DB_NAME ?? 'jungle_gaming',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres_password',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  entities: [WalletEntity, WalletLedgerEntryEntity, WagerTransactionEntity, InboxMessageEntity, OutboxMessageEntity],
  migrations: {
    path: './dist/infrastructure/database/migrations',
    pathTs: './src/infrastructure/database/migrations',
  },
  debug: false,
});