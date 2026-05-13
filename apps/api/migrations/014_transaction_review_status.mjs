/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export async function up(pgm) {
  // Add the new enum type for user-driven review
  pgm.sql(`
    DO $$ BEGIN
      CREATE TYPE review_status AS ENUM ('USER_REVIEWED', 'USER_FLAGGED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // Add the nullable column to transactions
  pgm.sql(`
    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS review_status review_status NULL;
  `)

  // Index for fast filter queries (most values will be NULL so partial index on non-null)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_transactions_review_status
      ON transactions (review_status)
      WHERE review_status IS NOT NULL;
  `)
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export async function down(pgm) {
  pgm.sql(`ALTER TABLE transactions DROP COLUMN IF EXISTS review_status;`)
  pgm.sql(`DROP TYPE IF EXISTS review_status;`)
}
