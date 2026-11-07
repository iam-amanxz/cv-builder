import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '#/db'
import type { CvDoc } from '#/cv/schema'

export interface BankEntry {
    text: string
    /** Where it was written: "Master CV · Senior Engineer · Acme". */
    sources: string[]
    lastSeen: number
}

/**
 * Every bullet ever written, from all CVs and all saved versions, de-duplicated.
 * Derived on demand; no separate store to keep in sync.
 */
export const bulletBank = createServerFn({ method: 'GET' }).handler(async (): Promise<BankEntry[]> => {
    const db = getDb()
    const { variants, snapshots } = schema
    const names = new Map(
        db
            .select({ id: variants.id, name: variants.name })
            .from(variants)
            .all()
            .map((v) => [v.id, v.name]),
    )
    const docs: { variantId: string; doc: CvDoc; at: number }[] = [
        ...db
            .select({ variantId: variants.id, doc: variants.doc, at: variants.updatedAt })
            .from(variants)
            .where(eq(variants.archived, false))
            .all()
            .map((r) => ({ ...r, at: r.at.getTime() })),
        ...db
            .select({ variantId: snapshots.variantId, doc: snapshots.doc, at: snapshots.createdAt })
            .from(snapshots)
            .all()
            .map((r) => ({ ...r, at: r.at.getTime() })),
    ]

    const bank = new Map<string, BankEntry>()
    const add = (text: string, source: string, at: number) => {
        const t = text.trim()
        if (t.length < 12) return
        const key = t.toLowerCase().replace(/\s+/g, ' ')
        const e = bank.get(key)
        if (!e) bank.set(key, { text: t, sources: [source], lastSeen: at })
        else {
            if (!e.sources.includes(source)) e.sources.push(source)
            if (at > e.lastSeen) Object.assign(e, { text: t, lastSeen: at })
        }
    }
    for (const { variantId, doc: stored, at } of docs) {
        // Old snapshots may predate some fields; treat stored docs as partial.
        const doc = stored as Partial<CvDoc>
        const cv = names.get(variantId) ?? 'CV'
        for (const w of doc.work ?? [])
            for (const h of w.highlights) add(h, [cv, w.position, w.name].filter(Boolean).join(' · '), at)
        for (const p of doc.projects ?? [])
            for (const h of p.highlights) add(h, [cv, p.name].filter(Boolean).join(' · '), at)
        for (const e of doc.education ?? [])
            for (const h of e.highlights) add(h, [cv, e.institution].filter(Boolean).join(' · '), at)
    }
    return [...bank.values()].sort((a, b) => b.lastSeen - a.lastSeen)
})
