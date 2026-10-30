import { describe, expect, test } from '@jest/globals';
import { Money } from './money';

describe('Value Object - Money', () => {
  test('deve criar uma instância válida de Money', () => {
    const money = Money.from({ amount: '10.50', currency: 'BRL' });
    expect(money.toString()).toBe('10.50');
    expect(money.currency).toBe('BRL');
  });

  test('deve somar valores da mesma moeda corretamente', () => {
    const m1 = Money.from({ amount: '10.25', currency: 'BRL' });
    const m2 = Money.from({ amount: '5.75', currency: 'BRL' });
    const result = m1.add(m2);

    expect(result.toString()).toBe('16.00');
  });

  test('deve lançar erro ao tentar somar moedas diferentes', () => {
    const m1 = Money.from({ amount: '10.00', currency: 'BRL' });
    const m2 = Money.from({ amount: '10.00', currency: 'USD' });

    expect(() => m1.add(m2)).toThrow('Moedas incompatíveis: BRL e USD');
  });

  test('deve rejeitar valores com mais de 2 casas decimais', () => {
    expect(() => Money.from({ amount: '10.505', currency: 'BRL' })).toThrow(
      'Amount não pode ter mais de 2 casas decimais.',
    );
  });

  test('deve rejeitar notação científica', () => {
    expect(() => Money.from({ amount: '1e3', currency: 'BRL' })).toThrow(
      'Formato de amount inválido.',
    );
  });
});