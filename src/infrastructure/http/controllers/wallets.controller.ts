import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CreateWalletUseCase } from '../../../application/use-cases/create-wallet.use-case';
import { ReconcileWalletUseCase } from '../../../application/use-cases/reconcile-wallet.use-case';
import { AuthGuard } from '../guards/auth.guard';
import { EntityManager } from '@mikro-orm/postgresql';
import { WalletEntity } from '../../database/entities/wallet.entity';
import { WalletLedgerEntryEntity } from '../../database/entities/wallet-ledger-entry.entity';
import { CreateWalletDto } from '../dto/create-wallet.dto';

@Controller('wallets')
@UseGuards(AuthGuard)
export class WalletsController {
  constructor(
    private readonly em: EntityManager,
    private readonly createWalletUseCase: CreateWalletUseCase,
    private readonly reconcileWalletUseCase: ReconcileWalletUseCase,
  ) {}

  @Post()
  async createWallet(@Body() body: CreateWalletDto) {
    return await this.createWalletUseCase.execute(body);
  }

  @Post(':walletId/reconciliation')
  async reconcile(@Param('walletId', ParseUUIDPipe) walletId: string) {
    return await this.reconcileWalletUseCase.execute(walletId);
  }

  @Get(':walletId')
  async getWallet(@Param('walletId', ParseUUIDPipe) walletId: string) {
    const wallet = await this.em.findOneOrFail(WalletEntity, walletId);
    return {
      id: wallet.id,
      playerId: wallet.playerId,
      balance: { amount: wallet.balanceAmount, currency: wallet.currency },
      version: wallet.version,
      createdAt: wallet.createdAt,
    };
  }

  @Get(':walletId/ledger')
  async getLedger(
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('O limite deve estar entre 1 e 100.');
    }

    const wallet = await this.em.findOneOrFail(WalletEntity, walletId);
    const entries = await this.em.find(
      WalletLedgerEntryEntity,
      { walletId },
      { orderBy: { createdAt: 'DESC' }, limit: Number(limit) },
    );
    return entries.map((e) => ({
      id: e.id,
      transactionId: e.transactionId,
      direction: e.direction,
      amount: { amount: e.amount, currency: wallet.currency },
      balanceBefore: { amount: e.balanceBefore, currency: wallet.currency },
      balanceAfter: { amount: e.balanceAfter, currency: wallet.currency },
      createdAt: e.createdAt,
    }));
  }
}