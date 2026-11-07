import { defFor } from '#/components/editor/section-config'
import { resolvedSectionOrder, sectionTitle } from './schema'
import type { AnyItem } from '#/components/editor/section-config'
import type { CvDoc } from './schema'
import type { ThemeTokens } from '#/themes/types'

/**
 * CV-aware diff between two versions (A = older/base, B = newer/target).
 * Items are matched by id, so edits read as "changed" instead of
 * remove + add. Lists (bullets, keywords) get a line-level diff.
 */

export interface FieldChange {
    label: string
    before: string
    after: string
}

export type LineOp = { op: 'same' | 'add' | 'del'; text: string }

export interface ListChange {
    label: string
    lines: LineOp[]
}

export type ItemChange =
    | { kind: 'added' | 'removed'; id: string; title: string }
    | {
          kind: 'changed'
          id: string
          title: string
          fields: FieldChange[]
          lists: ListChange[]
          visibility?: 'hidden' | 'shown'
      }

export interface SectionChange {
    key: string
    title: string
    status: 'added' | 'removed' | 'changed'
    fields: FieldChange[]
    items: ItemChange[]
    reordered: boolean
}

export interface CvDiff {
    basics: FieldChange[]
    sections: SectionChange[]
    layout: string[]
    theme: FieldChange[]
    count: number
}

const BASICS_LABELS: Record<string, string> = {
    name: 'Name',
    label: 'Headline',
    email: 'Email',
    phone: 'Phone',
    url: 'Website',
    location: 'Location',
}

const TOKEN_LABELS: Record<keyof ThemeTokens, string> = {
    fontBody: 'Body font',
    fontHeading: 'Heading font',
    fontSize: 'Text size',
    lineHeight: 'Line height',
    accent: 'Accent colour',
    text: 'Text colour',
    muted: 'Muted colour',
    pageSize: 'Page size',
    marginMm: 'Margins',
    sectionGap: 'Section spacing',
}

const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean)

/** LCS line diff, fine for the short lists a CV has. */
export function diffLines(a: string[], b: string[]): LineOp[] {
    const n = a.length
    const m = b.length
    const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
    for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
            lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    const out: LineOp[] = []
    let i = 0
    let j = 0
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            out.push({ op: 'same', text: a[i] })
            i++
            j++
        } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ op: 'del', text: a[i++] })
        else out.push({ op: 'add', text: b[j++] })
    }
    while (i < n) out.push({ op: 'del', text: a[i++] })
    while (j < m) out.push({ op: 'add', text: b[j++] })
    return out
}

function fieldChange(label: string, before: unknown, after: unknown): FieldChange | null {
    const a = typeof before === 'string' ? before.trim() : String(before ?? '')
    const b = typeof after === 'string' ? after.trim() : String(after ?? '')
    return a === b ? null : { label, before: a, after: b }
}

function sectionItems(doc: CvDoc, key: string): AnyItem[] | null {
    if (key === 'summary') return null
    if (key.startsWith('custom:')) {
        const c = doc.custom.find((x) => `custom:${x.id}` === key)
        return c ? c.items : null
    }
    return ((doc as unknown as Record<string, unknown>)[key] as AnyItem[] | undefined) ?? null
}

function diffItem(key: string, a: AnyItem, b: AnyItem): ItemChange | null {
    const def = defFor(key)
    if (!def) return null
    const fields: FieldChange[] = []
    const lists: ListChange[] = []
    for (const f of def.fields) {
        const av = a[f.key]
        const bv = b[f.key]
        if (Array.isArray(av) || Array.isArray(bv)) {
            const la = clean((av as string[] | undefined) ?? [])
            const lb = clean((bv as string[] | undefined) ?? [])
            if (la.join('\n') !== lb.join('\n')) lists.push({ label: f.label, lines: diffLines(la, lb) })
        } else {
            const c = fieldChange(f.label, av, bv)
            if (c) fields.push(c)
        }
    }
    const visibility = a.hidden === b.hidden ? undefined : b.hidden ? 'hidden' : 'shown'
    if (!fields.length && !lists.length && !visibility) return null
    return { kind: 'changed', id: b.id, title: def.summary(b), fields, lists, visibility }
}

function diffSection(a: CvDoc, b: CvDoc, key: string): SectionChange | null {
    const titleA = sectionTitle(a, key)
    const titleB = sectionTitle(b, key)
    const fields: FieldChange[] = []
    const t = fieldChange('Heading', titleA, titleB)
    if (t) fields.push(t)

    if (key === 'summary') {
        const s = fieldChange('Summary', a.basics.summary, b.basics.summary)
        if (s) fields.push(s)
        return fields.length ? { key, title: titleB, status: 'changed', fields, items: [], reordered: false } : null
    }

    const ia = sectionItems(a, key)
    const ib = sectionItems(b, key)
    if (!ia && !ib) return null
    const def = defFor(key)
    if (!ia || !ib) {
        const items = (ib ?? ia ?? []).map((x): ItemChange => ({
            kind: ib ? 'added' : 'removed',
            id: x.id,
            title: def?.summary(x) ?? x.id,
        }))
        return {
            key,
            title: ib ? titleB : titleA,
            status: ib ? 'added' : 'removed',
            fields: [],
            items,
            reordered: false,
        }
    }

    const byIdA = new Map(ia.map((x) => [x.id, x]))
    const byIdB = new Map(ib.map((x) => [x.id, x]))
    const items: ItemChange[] = []
    for (const x of ib) {
        const old = byIdA.get(x.id)
        if (!old) items.push({ kind: 'added', id: x.id, title: def?.summary(x) ?? x.id })
        else {
            const c = diffItem(key, old, x)
            if (c) items.push(c)
        }
    }
    for (const x of ia) {
        if (!byIdB.has(x.id)) items.push({ kind: 'removed', id: x.id, title: def?.summary(x) ?? x.id })
    }
    const commonA = ia.filter((x) => byIdB.has(x.id)).map((x) => x.id)
    const commonB = ib.filter((x) => byIdA.has(x.id)).map((x) => x.id)
    const reordered = commonA.join() !== commonB.join()

    if (!fields.length && !items.length && !reordered) return null
    return { key, title: titleB, status: 'changed', fields, items, reordered }
}

export function diffCv(
    a: { doc: CvDoc; tokens: ThemeTokens; themeName: string },
    b: { doc: CvDoc; tokens: ThemeTokens; themeName: string },
): CvDiff {
    const basics: FieldChange[] = []
    for (const [k, label] of Object.entries(BASICS_LABELS)) {
        const c = fieldChange(
            label,
            (a.doc.basics as Record<string, unknown>)[k],
            (b.doc.basics as Record<string, unknown>)[k],
        )
        if (c) basics.push(c)
    }
    const profiles = (d: CvDoc) =>
        d.basics.profiles.map((p) => [p.network, p.url || p.username].filter(Boolean).join(': '))
    const pa = clean(profiles(a.doc))
    const pb = clean(profiles(b.doc))
    if (pa.join('\n') !== pb.join('\n')) {
        basics.push({ label: 'Profiles', before: pa.join(', '), after: pb.join(', ') })
    }

    const orderA = resolvedSectionOrder(a.doc)
    const orderB = resolvedSectionOrder(b.doc)
    const keys = [...orderB, ...orderA.filter((k) => !orderB.includes(k))]
    const sections = keys.map((k) => diffSection(a.doc, b.doc, k)).filter((s): s is SectionChange => s !== null)

    const layout: string[] = []
    const common = (o: string[], other: string[]) => o.filter((k) => other.includes(k))
    if (common(orderA, orderB).join() !== common(orderB, orderA).join()) {
        layout.push(
            `Section order: ${orderB
                .filter((k) => orderA.includes(k))
                .map((k) => sectionTitle(b.doc, k))
                .join(' → ')}`,
        )
    }
    const hiddenA = new Set(a.doc.meta.hiddenSections)
    const hiddenB = new Set(b.doc.meta.hiddenSections)
    for (const k of orderB) {
        if (hiddenB.has(k) && !hiddenA.has(k)) layout.push(`Hid section “${sectionTitle(b.doc, k)}”`)
        if (!hiddenB.has(k) && hiddenA.has(k)) layout.push(`Showed section “${sectionTitle(b.doc, k)}”`)
    }

    const theme: FieldChange[] = []
    const tn = fieldChange('Theme', a.themeName, b.themeName)
    if (tn) theme.push(tn)
    for (const [k, label] of Object.entries(TOKEN_LABELS)) {
        const c = fieldChange(label, a.tokens[k as keyof ThemeTokens], b.tokens[k as keyof ThemeTokens])
        if (c) theme.push(c)
    }

    const count =
        basics.length +
        sections.reduce(
            (n, s) => n + s.fields.length + s.items.length + (s.reordered ? 1 : 0) + (s.status !== 'changed' ? 1 : 0),
            0,
        ) +
        layout.length +
        theme.length

    return { basics, sections, layout, theme, count }
}
