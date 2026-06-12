import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_workshop_jobs_job_type" AS ENUM('vehicle_image', 'marketing_asset');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_workshop_jobs_aspect_ratio" AS ENUM('16:9', '1:1', '9:16', '4:3');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "workshop_jobs" ADD COLUMN IF NOT EXISTS "job_type" "enum_workshop_jobs_job_type" DEFAULT 'vehicle_image';
    ALTER TABLE "workshop_jobs" ADD COLUMN IF NOT EXISTS "aspect_ratio" "enum_workshop_jobs_aspect_ratio" DEFAULT '16:9';
    ALTER TYPE "enum_workshop_jobs_save_destination" ADD VALUE IF NOT EXISTS 'media_library';

    CREATE INDEX IF NOT EXISTS "workshop_jobs_job_type_idx" ON "workshop_jobs" USING btree ("job_type");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "workshop_jobs_job_type_idx";
    ALTER TABLE "workshop_jobs" DROP COLUMN IF EXISTS "aspect_ratio";
    ALTER TABLE "workshop_jobs" DROP COLUMN IF EXISTS "job_type";
    DROP TYPE IF EXISTS "enum_workshop_jobs_aspect_ratio";
    DROP TYPE IF EXISTS "enum_workshop_jobs_job_type";
  `)
}
