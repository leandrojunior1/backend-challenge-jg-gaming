import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, test } from '@jest/globals';
import { WagerTransactionDto } from './wager-transaction.dto';

const validPayload = {
  providerId: 'provider-a',
  externalTransactionId: 'external-transaction',
  playerId: '4c4bf15e-5349-4bf8-80e9-7749c3aa9b85',
  walletId: '40b971d3-d0a9-4bd3-8589-b1fa44ca6684',
  roundId: 'round-1',
  gameId: 'game-1',
  kind: 'BET',
  money: { amount: '10.00', currency: 'BRL' },
};

describe('WagerTransactionDto', () => {
  test('aceita uma aposta válida', async () => {
    const dto = plainToInstance(WagerTransactionDto, validPayload);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  test('rejeita valor zero', async () => {
    const dto = plainToInstance(WagerTransactionDto, {
      ...validPayload,
      money: { amount: '0.00', currency: 'BRL' },
    });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  test('rejeita criação pública de transação OPENING', async () => {
    const dto = plainToInstance(WagerTransactionDto, { ...validPayload, kind: 'OPENING' });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
