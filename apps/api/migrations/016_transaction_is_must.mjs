/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS is_must boolean NULL;
  `)

  // Partial index: most rows will be NULL (treated as must); only index explicit false
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_transactions_is_must
      ON transactions (is_must)
      WHERE is_must IS NOT NULL;
  `)
}

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_transactions_is_must;`)
  pgm.sql(`ALTER TABLE transactions DROP COLUMN IF EXISTS is_must;`)
}
