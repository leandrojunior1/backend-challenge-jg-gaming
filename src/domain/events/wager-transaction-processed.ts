import { IntegrationEvent, IntegrationEventProps } from './integration-event';
import { WagerTransactionKind, WagerTransactionStatus } from '../transaction/wager-transaction';

export interface WagerTransactionProcessedData {
  transactionId: string;
  kind: WagerTransactionKind;
  status: WagerTransactionStatus;
}

export class WagerTransactionProcessed extends IntegrationEvent<WagerTransactionProcessedData> {
  readonly eventType = 'WagerTransactionProcessed';
  readonly version = 1;

  public static create(
    props: IntegrationEventProps<WagerTransactionProcessedData>,
  ): WagerTransactionProcessed {
    return new WagerTransactionProcessed(props);
  }
}