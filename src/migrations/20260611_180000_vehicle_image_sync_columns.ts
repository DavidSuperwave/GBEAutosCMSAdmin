import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "image_url" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "image_path" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "image_filename" varchar;

    CREATE INDEX IF NOT EXISTS "vehicles_source_id_idx" ON "vehicles" USING btree ("source_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "vehicles_source_id_idx";

    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "image_filename";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "image_path";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "image_url";
  `)
}
