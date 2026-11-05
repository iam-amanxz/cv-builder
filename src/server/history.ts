import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { cvDocSchema } from '#/cv/schema'
import { getTheme } from '#/themes'
import { createSnapshot } from './snapshots.server'
import type { ThemeOverrides, ThemeTokens } from '#/themes'

const { variants, snapshots, exportsTable } = schema

/** Turn resolved tokens back into overrides relative to the theme's defaults. */
function overridesFrom(themeId: string, tokens: ThemeTokens): ThemeOverrides {
    const defaults = getTheme(themeId).defaults
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(tokens) as (keyof ThemeTokens)[]) {
        if (tokens[k] !== defaults[k]) out[k] = tokens[k]
    }
    return out
}

export const listSnapshots = createServerFn({ method: 'GET' })
    .validator(z.object({ variantId: z.string() }))
    .handler(async ({ data }) => {
        const db = getDb()
        const rows = db
            .select({
                id: snapshots.id,
                label: snapshots.label,
                reason: snapshots.reason,
                themeId: snapshots.themeId,
                createdAt: snapshots.createdAt,
            })
            .from(snapshots)
            .where(eq(snapshots.variantId, data.variantId))
            .orderBy(desc(snapshots.createdAt))
            .all()
        const files = db
            .select({
                id: exportsTable.id,
                snapshotId: exportsTable.snapshotId,
                format: exportsTable.format,
                fileName: exportsTable.fileName,
            })
            .from(exportsTable)
            .innerJoin(snapshots, eq(snapshots.id, exportsTable.snapshotId))
            .where(eq(snapshots.variantId, data.variantId))
            .all()
        return rows.map((r) => ({
            ...r,
            exports: files.filter((f) => f.snapshotId === r.id),
        }))
    })

export const saveVersion = createServerFn({ method: 'POST' })
    .validator(z.object({ variantId: z.string(), label: z.string().trim().max(120) }))
    .handler(async ({ data }) => {
        const { id } = createSnapshot(data.variantId, 'manual', data.label)
        return { id }
    })

export const renameSnapshot = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string(), label: z.string().trim().max(120) }))
    .handler(async ({ data }) => {
        getDb().update(snapshots).set({ label: data.label }).where(eq(snapshots.id, data.id)).run()
        return { ok: true }
    })

/**
 * Copy a snapshot back into its variant. The current state is snapshotted
 * first, so a restore is itself undoable.
 */
export const restoreSnapshot = createServerFn({ method: 'POST' })
    .validator(z.object({ snapshotId: z.string() }))
    .handler(async ({ data }) => {
        const db = getDb()
        const snap = db.select().from(snapshots).where(eq(snapshots.id, data.snapshotId)).get()
        if (!snap) throw new Error('Version not found')
        const when = snap.createdAt.toISOString().slice(0, 16).replace('T', ' ')
        db.transaction(() => {
            createSnapshot(snap.variantId, 'restore', `Before restoring ${snap.label || when}`)
            db.update(variants)
                .set({
                    doc: cvDocSchema.parse(snap.doc),
                    themeId: snap.themeId,
                    themeOverrides: overridesFrom(snap.themeId, snap.themeTokens),
                    updatedAt: new Date(),
                })
                .where(eq(variants.id, snap.variantId))
                .run()
        })
        return { variantId: snap.variantId }
    })

/** New variant from a variant's working copy or from a frozen snapshot. */
export const forkVariant = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            name: z.string().trim().min(1).max(100),
            variantId: z.string().optional(),
            snapshotId: z.string().optional(),
        }),
    )
    .handler(async ({ data }) => {
        const db = getDb()
        let source: {
            parentId: string
            doc: unknown
            themeId: string
            themeOverrides: ThemeOverrides
        }
        if (data.snapshotId) {
            const s = db.select().from(snapshots).where(eq(snapshots.id, data.snapshotId)).get()
            if (!s) throw new Error('Version not found')
            source = {
                parentId: s.variantId,
                doc: s.doc,
                themeId: s.themeId,
                themeOverrides: overridesFrom(s.themeId, s.themeTokens),
            }
        } else if (data.variantId) {
            const v = db
                .select()
                .from(variants)
                .where(and(eq(variants.id, data.variantId), eq(variants.archived, false)))
                .get()
            if (!v) throw new Error('CV not found')
            source = { parentId: v.id, doc: v.doc, themeId: v.themeId, themeOverrides: v.themeOverrides }
        } else {
            throw new Error('Nothing to copy from')
        }
        const id = nanoid(10)
        db.insert(variants)
            .values({
                id,
                name: data.name,
                parentId: source.parentId,
                doc: cvDocSchema.parse(source.doc),
                themeId: source.themeId,
                themeOverrides: source.themeOverrides,
                updatedAt: new Date(),
            })
            .run()
        return { id }
    })
