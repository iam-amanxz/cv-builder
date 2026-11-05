import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getDb, schema } from '#/db'
import { resolveTokens } from '#/themes'

const { variants, snapshots } = schema

export type SnapshotReason = (typeof snapshots.$inferInsert)['reason']

/** Freeze the variant's current doc + resolved theme tokens. */
export function createSnapshot(variantId: string, reason: SnapshotReason, label = '') {
    const db = getDb()
    const v = db.select().from(variants).where(eq(variants.id, variantId)).get()
    if (!v) throw new Error('CV not found')
    const id = nanoid(12)
    db.insert(snapshots)
        .values({
            id,
            variantId,
            label,
            reason,
            doc: v.doc,
            themeId: v.themeId,
            themeTokens: resolveTokens(v.themeId, v.themeOverrides),
        })
        .run()
    return { id, variant: v }
}
