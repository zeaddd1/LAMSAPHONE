import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261116030000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "assistant_faq" ("id" text not null, "question" text not null, "answer" text not null, "keywords" text not null default '', "is_active" boolean not null default true, "rank" integer not null default 0, "hits" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "assistant_faq_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_assistant_faq_deleted_at" ON "assistant_faq" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "assistant_conversation" ("id" text not null, "channel" text not null, "external_id" text not null, "name" text null, "mode" text not null default 'bot', "status" text not null default 'open', "needs_human" boolean not null default false, "unread" integer not null default 0, "last_text" text null, "last_message_at" timestamptz null, "order_status" text null, "order_note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "assistant_conversation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_assistant_conversation_external_id" ON "assistant_conversation" ("external_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_assistant_conversation_deleted_at" ON "assistant_conversation" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "assistant_message" ("id" text not null, "conversation_id" text not null, "direction" text not null, "sender" text not null, "text" text not null, "external_id" text null, "intent" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "assistant_message_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_assistant_message_conversation_id" ON "assistant_message" ("conversation_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_assistant_message_deleted_at" ON "assistant_message" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "assistant_faq" cascade;`);
    this.addSql(`drop table if exists "assistant_conversation" cascade;`);
    this.addSql(`drop table if exists "assistant_message" cascade;`);
  }

}
