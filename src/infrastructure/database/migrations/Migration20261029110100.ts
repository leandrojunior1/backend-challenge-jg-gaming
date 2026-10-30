import { Migration } from '@mikro-orm/migrations';

export class Migration20261029110100 extends Migration {
  async up(): Promise<void> {
    this.addSql(`create type "wallet_ledger_entries_direction_enum" as enum ('DEBIT', 'CREDIT');`);
    this.addSql(`create type "wager_transactions_kind_enum" as enum ('OPENING', 'BET', 'WIN', 'LOSS', 'REFUND', 'ROLLBACK');`);
    this.addSql(`create type "wager_transactions_status_enum" as enum ('PENDING', 'PENDING_REFERENCE', 'PROCESSED', 'REJECTED', 'FAILED');`);

    this.addSql(`create table "wallets" (
      "id" uuid not null,
      "player_id" uuid not null,
      "currency" varchar(3) not null,
      "balance_amount" numeric(18, 2) not null,
      "version" int not null,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null,
      constraint "wallets_pkey" primary key ("id"),
      constraint "wallets_check" check ("balance_amount" >= 0),
      constraint "wallets_player_id_currency_unique" unique ("player_id", "currency")
    );`);

    this.addSql(`create table "wallet_ledger_entries" (
      "id" uuid not null,
      "wallet_id" uuid not null,
      "transaction_id" uuid not null,
      "direction" "wallet_ledger_entries_direction_enum" not null,
      "amount" numeric(18, 2) not null,
      "balance_before" numeric(18, 2) not null,
      "balance_after" numeric(18, 2) not null,
      "created_at" timestamptz not null,
      constraint "wallet_ledger_entries_pkey" primary key ("id"),
      constraint "wallet_ledger_entries_check" check ("amount" > 0 AND "balance_before" >= 0 AND "balance_after" >= 0)
    );`);
    this.addSql(`create index "wallet_ledger_entries_wallet_id_index" on "wallet_ledger_entries" ("wallet_id");`);
    this.addSql(`create index "wallet_ledger_entries_transaction_id_index" on "wallet_ledger_entries" ("transaction_id");`);

    this.addSql(`create table "wager_transactions" (
      "id" uuid not null,
      "provider_id" varchar(100) not null,
      "external_transaction_id" varchar(150) not null,
      "idempotency_key" varchar(255) not null,
      "payload_hash" varchar(64) not null,
      "wallet_id" uuid not null,
      "player_id" uuid not null,
      "round_id" varchar(150) not null,
      "game_id" varchar(150) not null,
      "kind" "wager_transactions_kind_enum" not null,
      "status" "wager_transactions_status_enum" not null,
      "amount" numeric(18, 2) not null,
      "currency" varchar(3) not null,
      "reference_external_transaction_id" varchar(150) null,
      "reference_transaction_id" uuid null,
      "failure_code" varchar(100) null,
      "created_at" timestamptz not null,
      "processed_at" timestamptz null,
      constraint "wager_transactions_pkey" primary key ("id"),
      constraint "wager_transactions_check" check ("amount" > 0),
      constraint "wager_transactions_provider_id_external_transaction_id_unique" unique ("provider_id", "external_transaction_id")
    );`);
    this.addSql(`create index "wager_transactions_idempotency_key_index" on "wager_transactions" ("idempotency_key");`);
    this.addSql(`create index "wager_transactions_wallet_id_index" on "wager_transactions" ("wallet_id");`);
    this.addSql(`create index "wager_transactions_status_index" on "wager_transactions" ("status");`);

    this.addSql(`create table "inbox_messages" (
      "id" uuid not null,
      "message_id" varchar(255) not null,
      "consumer_name" varchar(100) not null,
      "payload_hash" varchar(64) not null,
      "received_at" timestamptz not null,
      "processed_at" timestamptz null,
      constraint "inbox_messages_pkey" primary key ("id"),
      constraint "inbox_messages_consumer_name_message_id_unique" unique ("consumer_name", "message_id")
    );`);

    this.addSql(`create table "outbox_messages" (
      "id" uuid not null,
      "aggregate_id" uuid not null,
      "event_type" varchar(100) not null,
      "payload" jsonb not null,
      "occurred_at" timestamptz not null,
      "attempts" int not null default 0,
      "next_attempt_at" timestamptz null,
      "published_at" timestamptz null,
      constraint "outbox_messages_pkey" primary key ("id")
    );`);
    this.addSql(`create index "outbox_messages_next_attempt_at_index" on "outbox_messages" ("next_attempt_at");`);
    this.addSql(`create index "outbox_messages_published_at_index" on "outbox_messages" ("published_at");`);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "outbox_messages";');
    this.addSql('drop table if exists "inbox_messages";');
    this.addSql('drop table if exists "wager_transactions";');
    this.addSql('drop table if exists "wallet_ledger_entries";');
    this.addSql('drop table if exists "wallets";');
    this.addSql('drop type if exists "wager_transactions_status_enum";');
    this.addSql('drop type if exists "wager_transactions_kind_enum";');
    this.addSql('drop type if exists "wallet_ledger_entries_direction_enum";');
  }
}
