import { Migration } from "@medusajs/framework/mikro-orm/migrations";

// الزوايا الأربع والتوليد اليدوي: مصدر كل صورة (upload | api | manual)
export class Migration20261118020000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "quick_add_image" add column if not exists "source" text not null default 'upload';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "quick_add_image" drop column if exists "source";`);
  }

}
