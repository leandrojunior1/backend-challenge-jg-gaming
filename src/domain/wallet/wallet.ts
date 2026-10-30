import { Money } from '../money/money';
import { WalletLedgerEntry, LedgerDirection } from './wallet-ledger';

export interface WalletState {
  id: string;
  playerId: string;
  currency: string;
  balance: Money;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Wallet {
  private constructor(
    public readonly id: string,
    public readonly playerId: string,
    public readonly currency: string,
    private _balance: Money,
    private _version: number,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  public static open(props: {
    id: string;
    playerId: string;
    initialBalance: Money;
  }): Wallet {
    if (props.initialBalance.isNegative()) {
      throw new Error('O saldo inicial não pode ser negativo.');
    }

    const now = new Date();
    return new Wallet(
      props.id,
      props.playerId,
      props.initialBalance.currency,
      props.initialBalance,
      1,
      now,
      now,
    );
  }

  public static rehydrate(state: WalletState): Wallet {
    return new Wallet(
      state.id,
      state.playerId,
      state.currency,
      state.balance,
      state.version,
      state.createdAt,
      state.updatedAt,
    );
  }

  get balance(): Money {
    return this._balance;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  public credit(props: {
    transactionId: string;
    ledgerEntryId: string;
    amount: Money;
  }): WalletLedgerEntry {
    this.assertSameCurrency(props.amount);
    this.assertPositiveAmount(props.amount);

    const balanceBefore = this._balance;
    const balanceAfter = balanceBefore.add(props.amount);

    this._balance = balanceAfter;
    this._version += 1;
    this._updatedAt = new Date();

    return WalletLedgerEntry.create({
      id: props.ledgerEntryId,
      walletId: this.id,
      transactionId: props.transactionId,
      direction: LedgerDirection.Credit,
      money: props.amount,
      balanceBefore,
      balanceAfter,
      createdAt: this._updatedAt,
    });
  }

  public debit(props: {
    transactionId: string;
    ledgerEntryId: string;
    amount: Money;
  }): WalletLedgerEntry {
    this.assertSameCurrency(props.amount);
    this.assertPositiveAmount(props.amount);

    if (this._balance.isLessThan(props.amount)) {
      throw new Error('Saldo insuficiente para realizar o débito.');
    }

    const balanceBefore = this._balance;
    const balanceAfter = balanceBefore.subtract(props.amount);

    this._balance = balanceAfter;
    this._version += 1;
    this._updatedAt = new Date();

    return WalletLedgerEntry.create({
      id: props.ledgerEntryId,
      walletId: this.id,
      transactionId: props.transactionId,
      direction: LedgerDirection.Debit,
      money: props.amount,
      balanceBefore,
      balanceAfter,
      createdAt: this._updatedAt,
    });
  }

  private assertSameCurrency(money: Money): void {
    if (this.currency !== money.currency) {
      throw new Error(`Moeda da operação (${money.currency}) divergente da carteira (${this.currency}).`);
    }
  }

  private assertPositiveAmount(money: Money): void {
    if (!money.isPositive()) {
      throw new Error('O valor da operação deve ser maior que zero.');
    }
  }
}