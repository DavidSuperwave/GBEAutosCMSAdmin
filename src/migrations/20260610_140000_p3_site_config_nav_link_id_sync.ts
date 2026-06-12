import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Align SiteConfig navigation array row IDs with Payload's generated schema.
 * The P2 migration introduced footer/legal link arrays with serial IDs, but
 * Payload writes generated string IDs for array rows. SiteConfig saves then
 * failed when editing footer or legal links.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_config_navigation_footer_links"
      ALTER COLUMN "id" TYPE varchar USING "id"::varchar;

    ALTER TABLE "site_config_navigation_legal_links"
      ALTER COLUMN "id" TYPE varchar USING "id"::varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_config_navigation_footer_links"
      ALTER COLUMN "id" TYPE integer USING NULLIF("id", '')::integer;

    ALTER TABLE "site_config_navigation_legal_links"
      ALTER COLUMN "id" TYPE integer USING NULLIF("id", '')::integer;
  `)
}
