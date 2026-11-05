import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { cvDocSchema, emptyDoc } from '#/cv/schema'
import { sampleDoc } from '#/cv/sample'
import { DEFAULT_THEME_ID, THEMES } from '#/themes'
import { themeOverridesSchema } from '#/themes/types'

const { variants, snapshots, exportsTable } = schema

function ensureSeed() {
    const db = getDb()
    const any = db.select({ id: variants.id }).from(variants).limit(1).get()
    if (any) return
    db.insert(variants)
        .values({
            id: nanoid(10),
            name: 'Master CV',
            doc: sampleDoc(),
            themeId: DEFAULT_THEME_ID,
            themeOverrides: {},
            isMaster: true,
            updatedAt: new Date(),
        })
        .run()
}

export const listVariants = createServerFn({ method: 'GET' }).handler(async () => {
    ensureSeed()
    return getDb()
        .select({
            id: variants.id,
            name: variants.name,
            isMaster: variants.isMaster,
            parentId: variants.parentId,
            themeId: variants.themeId,
            updatedAt: variants.updatedAt,
        })
        .from(variants)
        .where(eq(variants.archived, false))
        .orderBy(desc(variants.isMaster), desc(variants.updatedAt))
        .all()
})

export const getVariant = createServerFn({ method: 'GET' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        const row = getDb()
            .select()
            .from(variants)
            .where(and(eq(variants.id, data.id), eq(variants.archived, false)))
            .get()
        if (!row) throw new Error('CV not found')
        // Re-parse so older docs pick up defaults for newly added fields.
        return { ...row, doc: cvDocSchema.parse(row.doc) }
    })

export const createVariant = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            name: z.string().trim().min(1).max(100),
            start: z.enum(['empty', 'sample']),
        }),
    )
    .handler(async ({ data }) => {
        const id = nanoid(10)
        getDb()
            .insert(variants)
            .values({
                id,
                name: data.name,
                doc: data.start === 'sample' ? sampleDoc() : emptyDoc(),
                themeId: DEFAULT_THEME_ID,
                themeOverrides: {},
                updatedAt: new Date(),
            })
            .run()
        return { id }
    })

export const updateVariant = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            id: z.string(),
            name: z.string().trim().min(1).max(100).optional(),
            doc: cvDocSchema.optional(),
            themeOverrides: themeOverridesSchema.optional(),
            themeId: z
                .string()
                .refine((id) => id in THEMES, 'Unknown theme')
                .optional(),
        }),
    )
    .handler(async ({ data }) => {
        const { id, ...patch } = data
        const updatedAt = new Date()
        const res = getDb()
            .update(variants)
            .set({ ...patch, updatedAt })
            .where(eq(variants.id, id))
            .run()
        if (res.changes === 0) throw new Error('CV not found')
        return { updatedAt }
    })

/** Soft delete: snapshots and exported files are never destroyed. */
export const archiveVariant = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        getDb()
            .update(variants)
            .set({ archived: true, updatedAt: new Date() })
            .where(and(eq(variants.id, data.id), eq(variants.isMaster, false)))
            .run()
        return { ok: true }
    })

export const listExports = createServerFn({ method: 'GET' })
    .validator(z.object({ variantId: z.string() }))
    .handler(async ({ data }) => {
        return getDb()
            .select({
                id: exportsTable.id,
                format: exportsTable.format,
                fileName: exportsTable.fileName,
                bytes: exportsTable.bytes,
                createdAt: exportsTable.createdAt,
                snapshotId: exportsTable.snapshotId,
            })
            .from(exportsTable)
            .innerJoin(snapshots, eq(snapshots.id, exportsTable.snapshotId))
            .where(eq(snapshots.variantId, data.variantId))
            .orderBy(desc(exportsTable.createdAt))
            .limit(20)
            .all()
    })
