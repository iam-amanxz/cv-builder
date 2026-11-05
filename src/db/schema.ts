import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
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
    themeOverrides: text('theme_overrides', { mode: 'json' }).$type<ThemeOverrides>().notNull().default({}),
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

/**
 * "My themes": a named set of tokens on top of a built-in theme component.
 * Applying one copies its tokens into the CV, so editing a preset later
 * never silently changes CVs that already use it.
 */
export const themePresets = sqliteTable('theme_presets', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    baseThemeId: text('base_theme_id').notNull(),
    tokens: text('tokens', { mode: 'json' }).$type<ThemeTokens>().notNull(),
    createdAt: createdAt(),
})

/** Every AI call: what was asked, what came back, and what it cost. */
export const aiRuns = sqliteTable(
    'ai_runs',
    {
        id: text('id').primaryKey(),
        kind: text('kind', { enum: ['bullets', 'tailor', 'summary', 'import', 'cover-letter'] }).notNull(),
        variantId: text('variant_id'),
        model: text('model').notNull(),
        status: text('status', { enum: ['ok', 'error', 'refusal'] }).notNull(),
        input: text('input', { mode: 'json' }).$type<unknown>().notNull(),
        output: text('output', { mode: 'json' }).$type<unknown>(),
        error: text('error'),
        inputTokens: integer('input_tokens').notNull().default(0),
        outputTokens: integer('output_tokens').notNull().default(0),
        costUsd: real('cost_usd'),
        durationMs: integer('duration_ms').notNull().default(0),
        createdAt: createdAt(),
    },
    (t) => [index('ai_runs_created_idx').on(t.createdAt)],
)
