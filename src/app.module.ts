import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import mikroOrmConfig from './mikro-orm.config';

import { WalletsController } from './infrastructure/http/controllers/wallets.controller';
import { WageringController } from './infrastructure/http/controllers/wagering.controller';
import { HealthController } from './infrastructure/http/controllers/health.controller';

import { CreateWalletUseCase } from './application/use-cases/create-wallet.use-case';
import { ProcessWagerTransactionUseCase } from './application/use-cases/process-wager-transaction.use-case';
import { ReconcileWalletUseCase } from './application/use-cases/reconcile-wallet.use-case';

import { OutboxPublisherWorker } from './infrastructure/workers/outbox-publisher.worker';
import { PendingReferenceWorker } from './infrastructure/workers/pending-reference.worker';
import { WagerSqsConsumer } from './infrastructure/messaging/wager-sqs.consumer';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MikroOrmModule.forRoot(mikroOrmConfig),
  ],
  controllers: [WalletsController, WageringController, HealthController],
  providers: [
    CreateWalletUseCase,
    ProcessWagerTransactionUseCase,
    ReconcileWalletUseCase,
    OutboxPublisherWorker,
    PendingReferenceWorker,
    WagerSqsConsumer,
  ],
})
export class AppModule {}