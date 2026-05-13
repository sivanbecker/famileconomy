/**
 * Migration: 010_within_file_duplicate_enum
 *
 * Adds WITHIN_FILE_DUPLICATE to the transaction_status enum.
 * ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
 * so this migration calls pgm.noTransaction() to opt out of the wrapper.
 */

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  pgm.noTransaction()
  pgm.addTypeValue('transaction_status', 'WITHIN_FILE_DUPLICATE', { ifNotExists: true })
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (_pgm) => {
  // PostgreSQL does not support removing enum values — manual rollback required.
}
