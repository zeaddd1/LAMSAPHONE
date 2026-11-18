import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261118010000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "quick_add_job" ("id" text not null, "status" text not null default 'pending', "error" text null, "title" text not null, "brand" text not null default '', "model_name" text not null default '', "condition" text not null default 'new', "parts" text not null default '', "preset" text not null default 'studio', "custom_prompt" text not null default '', "input" jsonb null, "private" jsonb null, "copy" jsonb null, "copy_status" text not null default 'pending', "copy_error" text null, "steps" jsonb null, "product_id" text null, "ai_calls" integer not null default 0, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "quick_add_job_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quick_add_job_deleted_at" ON "quick_add_job" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "quick_add_image" ("id" text not null, "kind" text not null default 'other', "note" text not null default '', "rank" integer not null default 0, "is_main" boolean not null default false, "excluded" boolean not null default false, "source_file_id" text not null, "source_url" text not null, "result_file_id" text null, "result_url" text null, "status" text not null default 'pending', "error" text null, "job_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "quick_add_image_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quick_add_image_job_id" ON "quick_add_image" ("job_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quick_add_image_deleted_at" ON "quick_add_image" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`alter table if exists "quick_add_image" add constraint "quick_add_image_job_id_foreign" foreign key ("job_id") references "quick_add_job" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "quick_add_image" drop constraint if exists "quick_add_image_job_id_foreign";`);
    this.addSql(`drop table if exists "quick_add_image" cascade;`);
    this.addSql(`drop table if exists "quick_add_job" cascade;`);
  }

}
