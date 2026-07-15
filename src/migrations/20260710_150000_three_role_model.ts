import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * F001 / D01 (approved 2026-07-10): collapse the six-role enum to the
 * three-role model admin / general / sales.
 *
 * Mapping: admin→admin; inventory_manager, content_editor, media_editor →
 * general; sales_manager, viewer → sales. Aborts if any user holds a role
 * outside that mapping or no role at all, so nobody is silently demoted.
 * F002 evidence (docs/product/evidence/) shows all current users are admin.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE unmapped integer;
    BEGIN
      SELECT count(*) INTO unmapped FROM "users"
      WHERE role IS NULL
         OR role::text NOT IN ('admin','inventory_manager','content_editor','media_editor','sales_manager','viewer');
      IF unmapped > 0 THEN
        RAISE EXCEPTION 'three_role_model: % user(s) hold no role or a role outside the approved mapping; map them before migrating', unmapped;
      END IF;
    END $$;

    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" TYPE varchar(50) USING role::text;

    UPDATE "users" SET role = CASE role
      WHEN 'inventory_manager' THEN 'general'
      WHEN 'content_editor' THEN 'general'
      WHEN 'media_editor' THEN 'general'
      WHEN 'sales_manager' THEN 'sales'
      WHEN 'viewer' THEN 'sales'
      ELSE role
    END;

    DROP TYPE IF EXISTS "public"."enum_users_role";
    CREATE TYPE "public"."enum_users_role" AS ENUM('admin','general','sales');
    ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."enum_users_role" USING role::"public"."enum_users_role";
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'sales';
  `)
}

/**
 * Lossy by necessity: general→content_editor and sales→sales_manager are the
 * closest six-role equivalents; the original finer-grained values cannot be
 * recovered.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" TYPE varchar(50) USING role::text;

    UPDATE "users" SET role = CASE role
      WHEN 'general' THEN 'content_editor'
      WHEN 'sales' THEN 'sales_manager'
      ELSE role
    END;

    DROP TYPE IF EXISTS "public"."enum_users_role";
    CREATE TYPE "public"."enum_users_role" AS ENUM('admin','inventory_manager','content_editor','sales_manager','media_editor','viewer');
    ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."enum_users_role" USING role::"public"."enum_users_role";
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'viewer';
  `)
}
