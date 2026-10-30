import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, ValidateNested } from 'class-validator';
import { WagerTransactionKind } from '../../../domain/transaction/wager-transaction';
import { PositiveMoneyDto } from './positive-money.dto';

const publicTransactionKinds = [
  WagerTransactionKind.Bet,
  WagerTransactionKind.Win,
  WagerTransactionKind.Loss,
  WagerTransactionKind.Refund,
  WagerTransactionKind.Rollback,
];

export class WagerTransactionDto {
  @IsString()
  @Length(1, 100)
  providerId!: string;

  @IsString()
  @Length(1, 150)
  externalTransactionId!: string;

  @IsUUID()
  playerId!: string;

  @IsUUID()
  walletId!: string;

  @IsString()
  @Length(1, 150)
  roundId!: string;

  @IsString()
  @Length(1, 150)
  gameId!: string;

  @IsIn(publicTransactionKinds)
  kind!: WagerTransactionKind;

  @ValidateNested()
  @Type(() => PositiveMoneyDto)
  money!: PositiveMoneyDto;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referenceExternalTransactionId?: string;
}
