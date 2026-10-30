import { beforeAll, describe, expect, test } from '@jest/globals';

describe('Concorrência - Disputa Simultânea de Saldo', () => {
  const BASE_URL = 'http://localhost:3000';
  const apiKey = process.env.API_KEY;
  let walletId: string;
  const playerId = crypto.randomUUID();

  beforeAll(async () => {
    if (!apiKey) {
      throw new Error('Configure API_KEY no ambiente antes de executar os testes de integração.');
    }

    const res = await fetch(`${BASE_URL}/wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        playerId,
        initialBalance: { amount: '100.00', currency: 'BRL' },
      }),
    });
    const data = await res.json();
    walletId = data.id;
  });

  test('50 apostas de 80.00 BRL em paralelo devem resultar em apenas 1 PROCESSED e 49 REJECTED', async () => {
    const requests = Array.from({ length: 50 }).map((_, index) => {
      const extTxId = `tx-concurrent-${index}`;
      return fetch(`${BASE_URL}/wagering/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey!,
          'Idempotency-Key': `provider-a:${extTxId}`,
        },
        body: JSON.stringify({
          providerId: 'provider-a',
          externalTransactionId: extTxId,
          playerId,
          walletId,
          roundId: 'round-1',
          gameId: 'slots',
          kind: 'BET',
          money: { amount: '80.00', currency: 'BRL' },
        }),
      }).then((r) => r.json());
    });

    const results = await Promise.all(requests);

    const processed = results.filter((r) => r.status === 'PROCESSED');
    const rejected = results.filter((r) => r.status === 'REJECTED');

    expect(processed.length).toBe(1);
    expect(rejected.length).toBe(49);

    const recRes = await fetch(`${BASE_URL}/wallets/${walletId}/reconciliation`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey! },
    });
    const recData = await recRes.json();

    expect(recData.consistent).toBe(true);
    expect(recData.storedBalance.amount).toBe('20.00');
    expect(recData.calculatedBalance.amount).toBe('20.00');
  });

  test('requisições simultâneas da mesma aposta só debitam o saldo uma vez', async () => {
    const externalTransactionId = `tx-idempotent-${crypto.randomUUID()}`;
    const payload = {
      providerId: 'provider-a',
      externalTransactionId,
      playerId,
      walletId,
      roundId: 'round-idempotent',
      gameId: 'slots',
      kind: 'BET',
      money: { amount: '5.00', currency: 'BRL' },
    };
    const send = () => fetch(`${BASE_URL}/wagering/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey!,
        'Idempotency-Key': `provider-a:${externalTransactionId}`,
      },
      body: JSON.stringify(payload),
    }).then((response) => response.json());

    const results = await Promise.all([send(), send()]);
    expect(results[0].transactionId).toBe(results[1].transactionId);
    expect(results.filter((result) => result.idempotentReplay).length).toBe(1);

    const walletResponse = await fetch(`${BASE_URL}/wallets/${walletId}`, {
      headers: { 'X-API-Key': apiKey! },
    });
    const wallet = await walletResponse.json();
    expect(wallet.balance.amount).toBe('15.00');
  });
});