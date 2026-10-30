import { describe, expect, test } from '@jest/globals';
import { Money } from '../money/money';
import { Wallet } from './wallet';

describe('Wallet', () => {
  const createWallet = (amount = '10.00') => Wallet.open({
    id: 'wallet-id',
    playerId: 'player-id',
    initialBalance: Money.from({ amount, currency: 'BRL' }),
  });

  test('não permite abrir uma carteira com saldo inicial negativo', () => {
    expect(() => createWallet('-1.00')).toThrow('O saldo inicial não pode ser negativo.');
  });

  test('não permite creditar um valor não positivo', () => {
    const wallet = createWallet();
    expect(() => wallet.credit({
      transactionId: 'transaction-id',
      ledgerEntryId: 'ledger-id',
      amount: Money.zero('BRL'),
    })).toThrow('O valor da operação deve ser maior que zero.');
  });

  test('não permite debitar um valor negativo', () => {
    const wallet = createWallet();
    expect(() => wallet.debit({
      transactionId: 'transaction-id',
      ledgerEntryId: 'ledger-id',
      amount: Money.from({ amount: '-1.00', currency: 'BRL' }),
    })).toThrow('O valor da operação deve ser maior que zero.');
  });
});
