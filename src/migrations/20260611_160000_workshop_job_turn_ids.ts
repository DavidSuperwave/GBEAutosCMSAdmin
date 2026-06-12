import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "workshop_jobs_messages" ADD COLUMN IF NOT EXISTS "turn_id" varchar;
    ALTER TABLE "workshop_jobs_outputs" ADD COLUMN IF NOT EXISTS "turn_id" varchar;

    CREATE INDEX IF NOT EXISTS "workshop_jobs_messages_turn_id_idx" ON "workshop_jobs_messages" USING btree ("turn_id");
    CREATE INDEX IF NOT EXISTS "workshop_jobs_outputs_turn_id_idx" ON "workshop_jobs_outputs" USING btree ("turn_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "workshop_jobs_outputs_turn_id_idx";
    DROP INDEX IF EXISTS "workshop_jobs_messages_turn_id_idx";
    ALTER TABLE "workshop_jobs_outputs" DROP COLUMN IF EXISTS "turn_id";
    ALTER TABLE "workshop_jobs_messages" DROP COLUMN IF EXISTS "turn_id";
  `)
}
