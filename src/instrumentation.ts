import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";

/**
 * Runs once when the Next.js server boots:
 *   1. applies pending Drizzle SQL migrations (idempotent, self-healing),
 *   2. seeds demo data if the database is empty.
 *
 * This keeps `npm run build && npm start` self-sufficient — no manual
 * `drizzle-kit push` step is required, though it is still supported.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { db } = await import("@/db");
  const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_FOLDER || "drizzle";

  try {
    // Self-healing: if the app tables are gone (e.g. `DROP SCHEMA public CASCADE`)
    // but Drizzle's bookkeeping schema survived, the migrator would think the
    // migration was already applied. Detect that and replay from scratch.
    const probe = await db.execute(sql`select to_regclass('public.users') as users_table`);
    const rows = (probe as unknown as { rows: { users_table: string | null }[] }).rows;
    const schemaPresent = Boolean(rows?.[0]?.users_table);

    if (!schemaPresent) {
      await db.execute(sql`drop schema if exists "drizzle" cascade`);
      await migrate(db, { migrationsFolder });
      console.info(`[instrumentation] schema created from ./${migrationsFolder}`);
    } else {
      await migrate(db, { migrationsFolder });
      console.info(`[instrumentation] migrations up to date (./${migrationsFolder})`);
    }
  } catch (err) {
    // Tables may already exist (e.g. created with `drizzle-kit push`). Continue —
    // the seed step below verifies the schema is usable.
    console.warn("[instrumentation] migration step skipped:", err);
  }

  try {
    const { ensureSeed } = await import("@/lib/seed");
    const result = await ensureSeed();
    console.info(
      result.seeded
        ? "[instrumentation] demo data seeded"
        : `[instrumentation] seed skipped (${result.reason})`,
    );
  } catch (err) {
    // Never crash the server because of a bootstrap hiccup (e.g. DB not ready).
    console.error("[instrumentation] database bootstrap failed:", err);
  }
}
