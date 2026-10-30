import { IntegrationEvent, IntegrationEventProps } from './integration-event';

export interface WagerTransactionRejectedData {
  transactionId: string;
  reason: string;
}

export class WagerTransactionRejected extends IntegrationEvent<WagerTransactionRejectedData> {
  readonly eventType = 'WagerTransactionRejected';
  readonly version = 1;

  public static create(
    props: IntegrationEventProps<WagerTransactionRejectedData>,
  ): WagerTransactionRejected {
    return new WagerTransactionRejected(props);
  }
}