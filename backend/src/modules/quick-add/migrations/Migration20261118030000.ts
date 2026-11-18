import { Migration } from "@medusajs/framework/mikro-orm/migrations";

// سجل استهلاك Gemini (حارس الحصص والسقف الشهري) + انتظار التجدد في المهام
export class Migration20261118030000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "quick_add_usage_log" ("id" text not null, "model" text not null, "kind" text not null, "result" text not null, "cost_usd" real not null default 0, "job_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "quick_add_usage_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quick_add_usage_log_created_at" ON "quick_add_usage_log" ("created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quick_add_usage_log_deleted_at" ON "quick_add_usage_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`alter table if exists "quick_add_job" add column if not exists "wait_until" timestamptz null;`);
    this.addSql(`alter table if exists "quick_add_job" add column if not exists "wait_task" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "quick_add_usage_log" cascade;`);
    this.addSql(`alter table if exists "quick_add_job" drop column if exists "wait_until";`);
    this.addSql(`alter table if exists "quick_add_job" drop column if exists "wait_task";`);
  }

}
