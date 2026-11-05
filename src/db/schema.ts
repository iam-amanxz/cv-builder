import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { CvDoc } from '#/cv/schema'
import type { ThemeOverrides, ThemeTokens } from '#/themes/types'

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`)

/** Editable working copies. One is the master; others are forks. */
export const variants = sqliteTable('variants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  doc: text('doc', { mode: 'json' }).$type<CvDoc>().notNull(),
  themeId: text('theme_id').notNull(),
  themeOverrides: text('theme_overrides', { mode: 'json' })
    .$type<ThemeOverrides>()
    .notNull()
    .default({}),
  isMaster: integer('is_master', { mode: 'boolean' }).notNull().default(false),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

/** Immutable frozen copies: doc + fully resolved theme tokens. */
export const snapshots = sqliteTable(
  'snapshots',
  {
    id: text('id').primaryKey(),
    variantId: text('variant_id')
      .notNull()
      .references(() => variants.id),
    label: text('label').notNull().default(''),
    doc: text('doc', { mode: 'json' }).$type<CvDoc>().notNull(),
    themeId: text('theme_id').notNull(),
    themeTokens: text('theme_tokens', { mode: 'json' }).$type<ThemeTokens>().notNull(),
    reason: text('reason', {
      enum: ['manual', 'export', 'ai-apply', 'restore'],
    }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('snapshots_variant_idx').on(t.variantId, t.createdAt)],
)

/** Every exported file, linked to the exact snapshot it was rendered from. */
export const exportsTable = sqliteTable(
  'exports',
  {
    id: text('id').primaryKey(),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => snapshots.id),
    format: text('format', { enum: ['pdf', 'docx', 'json', 'md'] }).notNull(),
    fileName: text('file_name').notNull(),
    bytes: integer('bytes').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('exports_snapshot_idx').on(t.snapshotId)],
)
