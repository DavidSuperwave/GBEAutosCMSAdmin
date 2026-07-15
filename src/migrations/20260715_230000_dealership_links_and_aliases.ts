import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the public agency links and the internal, newline-delimited source-name
 * aliases used by inventory imports. Alias values are never exposed by the
 * bounded public dealership endpoint.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "dealerships" ADD COLUMN IF NOT EXISTS "website_url" varchar;
    ALTER TABLE "dealerships" ADD COLUMN IF NOT EXISTS "map_url" varchar;
    ALTER TABLE "dealerships" ADD COLUMN IF NOT EXISTS "source_aliases" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "dealerships" DROP COLUMN IF EXISTS "source_aliases";
    ALTER TABLE "dealerships" DROP COLUMN IF EXISTS "map_url";
    ALTER TABLE "dealerships" DROP COLUMN IF EXISTS "website_url";
  `)
}
