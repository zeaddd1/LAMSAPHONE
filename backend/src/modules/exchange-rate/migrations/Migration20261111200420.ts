import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261111200420 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "exchange_rate" drop constraint if exists "exchange_rate_code_unique";`);
    this.addSql(`create table if not exists "exchange_rate" ("id" text not null, "code" text not null, "rate_per_usd" numeric not null default 0, "rounding_step" numeric not null default 0, "label_ar" text not null, "symbol" text not null, "is_active" boolean not null default false, "raw_rate_per_usd" jsonb not null default '{"value":"0","precision":20}', "raw_rounding_step" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "exchange_rate_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_exchange_rate_code_unique" ON "exchange_rate" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_exchange_rate_deleted_at" ON "exchange_rate" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "exchange_rate_history" ("id" text not null, "code" text not null, "old_rate" numeric null, "new_rate" numeric not null, "old_rounding_step" numeric null, "new_rounding_step" numeric not null, "old_is_active" boolean null, "new_is_active" boolean not null, "changed_by" text null, "raw_old_rate" jsonb null, "raw_new_rate" jsonb not null, "raw_old_rounding_step" jsonb null, "raw_new_rounding_step" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "exchange_rate_history_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_exchange_rate_history_code" ON "exchange_rate_history" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_exchange_rate_history_deleted_at" ON "exchange_rate_history" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "exchange_rate" cascade;`);

    this.addSql(`drop table if exists "exchange_rate_history" cascade;`);
  }

}
