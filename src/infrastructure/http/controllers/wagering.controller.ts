import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UseGuards,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProcessWagerTransactionUseCase } from '../../../application/use-cases/process-wager-transaction.use-case';
import { AuthGuard } from '../guards/auth.guard';
import { EntityManager } from '@mikro-orm/postgresql';
import { WagerTransactionEntity } from '../../database/entities/wager-transaction.entity';
import * as crypto from 'crypto';
import { WagerTransactionDto } from '../dto/wager-transaction.dto';

@Controller('wagering')
@UseGuards(AuthGuard)
export class WageringController {
  constructor(
    private readonly em: EntityManager,
    private readonly processWagerUseCase: ProcessWagerTransactionUseCase,
  ) {}

  @Post('transactions')
  async submitTransaction(
    @Headers('idempotency-key') idempotencyKeyHeader: string,
    @Body() body: WagerTransactionDto,
  ) {
    if (!idempotencyKeyHeader || idempotencyKeyHeader.length > 255) {
      throw new BadRequestException('O header Idempotency-Key é obrigatório e deve ter até 255 caracteres.');
    }

    const canonicalJson = JSON.stringify(this.canonicalize(body));
    const payloadHash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

    return await this.processWagerUseCase.execute({
      providerId: body.providerId,
      externalTransactionId: body.externalTransactionId,
      idempotencyKey: idempotencyKeyHeader,
      payloadHash,
      playerId: body.playerId,
      walletId: body.walletId,
      roundId: body.roundId,
      gameId: body.gameId,
      kind: body.kind,
      money: body.money,
      referenceExternalTransactionId: body.referenceExternalTransactionId,
    });
  }

  @Get('transactions/:transactionId')
  async getTransactionById(@Param('transactionId', ParseUUIDPipe) transactionId: string) {
    return await this.em.findOneOrFail(WagerTransactionEntity, transactionId);
  }

  @Get('providers/:providerId/wagering/transactions/:externalTransactionId')
  async getTransactionByExternalId(
    @Param('providerId') providerId: string,
    @Param('externalTransactionId') externalTransactionId: string,
  ) {
    return await this.em.findOneOrFail(WagerTransactionEntity, { providerId, externalTransactionId });
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalize(item));
    }

    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.canonicalize(item)]),
      );
    }

    return value;
  }
}