/**
 * Migration: 005_soft_dedup_enum
 *
 * Adds DUPLICATE and REVIEWED_OK to the transaction_status enum.
 * ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL,
 * so this migration calls pgm.noTransaction() to opt out of the wrapper.
 */

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  pgm.noTransaction()
  pgm.addTypeValue('transaction_status', 'DUPLICATE', { ifNotExists: true })
  pgm.addTypeValue('transaction_status', 'REVIEWED_OK', { ifNotExists: true })
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (_pgm) => {
  // PostgreSQL does not support removing enum values — a full type rebuild
  // would be required. Mark as no-op; manual rollback needed if required.
}
