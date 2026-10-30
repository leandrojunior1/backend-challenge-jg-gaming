import Decimal from 'decimal.js';

export interface MoneyProps {
  amount: string;
  currency: string;
}

export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal, public readonly currency: string) {
    this.value = value;
  }

  public static from(props: MoneyProps): Money {
    const { amount, currency } = props;

    if (!amount || typeof amount !== 'string') {
      throw new Error('Amount deve ser uma string decimal válida.');
    }

    if (!currency || typeof currency !== 'string') {
      throw new Error('Currency deve ser informada.');
    }

    if (/e/i.test(amount) || amount.trim() === '') {
      throw new Error('Formato de amount inválido.');
    }

    const decimalParts = amount.split('.');
    if (decimalParts.length > 2 || (decimalParts[1] && decimalParts[1].length > 2)) {
      throw new Error('Amount não pode ter mais de 2 casas decimais.');
    }

    const decimalValue = new Decimal(amount);

    if (decimalValue.isNaN() || !decimalValue.isFinite()) {
      throw new Error('Amount inválido.');
    }

    return new Money(
      new Decimal(decimalValue.toFixed(2, Decimal.ROUND_HALF_UP)),
      currency.toUpperCase(),
    );
  }

  public static zero(currency: string): Money {
    return Money.from({ amount: '0.00', currency });
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.plus(other.value), this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.minus(other.value), this.currency);
  }

  public negate(): Money {
    return new Money(this.value.negated(), this.currency);
  }

  public isZero(): boolean {
    return this.value.isZero();
  }

  public isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  public isNegative(): boolean {
    return this.value.isNegative();
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.lessThan(other.value);
  }

  public equals(other: Money): boolean {
    return this.currency === other.currency && this.value.equals(other.value);
  }

  public toJSON(): MoneyProps {
    return {
      amount: this.toString(),
      currency: this.currency,
    };
  }

  public toString(): string {
    return this.value.toFixed(2);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Moedas incompatíveis: ${this.currency} e ${other.currency}`);
    }
  }
}