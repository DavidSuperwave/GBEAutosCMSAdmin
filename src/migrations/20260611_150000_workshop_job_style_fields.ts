import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "workshop_jobs" ADD COLUMN IF NOT EXISTS "style_template_id" integer;
    ALTER TABLE "workshop_jobs" ADD COLUMN IF NOT EXISTS "style_name" varchar;
    ALTER TABLE "workshop_jobs" ADD COLUMN IF NOT EXISTS "style_prompt" varchar;
    ALTER TABLE "workshop_jobs" ADD COLUMN IF NOT EXISTS "style_reference_url" varchar;

    DO $$ BEGIN
      ALTER TABLE "workshop_jobs" ADD CONSTRAINT "workshop_jobs_style_template_id_image_templates_id_fk"
        FOREIGN KEY ("style_template_id") REFERENCES "public"."image_templates"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "workshop_jobs_style_template_idx" ON "workshop_jobs" USING btree ("style_template_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "workshop_jobs" DROP CONSTRAINT IF EXISTS "workshop_jobs_style_template_id_image_templates_id_fk";
    DROP INDEX IF EXISTS "workshop_jobs_style_template_idx";
    ALTER TABLE "workshop_jobs" DROP COLUMN IF EXISTS "style_reference_url";
    ALTER TABLE "workshop_jobs" DROP COLUMN IF EXISTS "style_prompt";
    ALTER TABLE "workshop_jobs" DROP COLUMN IF EXISTS "style_name";
    ALTER TABLE "workshop_jobs" DROP COLUMN IF EXISTS "style_template_id";
  `)
}
