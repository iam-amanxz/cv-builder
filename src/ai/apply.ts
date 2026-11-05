import type { CvDoc } from '#/cv/schema'
import type { TailorResult } from './schemas'

/** Stable keys for each proposal so the UI can tick them on/off. */
export const proposalKey = {
    summary: () => 'summary',
    bullet: (section: string, itemId: string, index: number) => `bullet:${section}:${itemId}:${index}`,
    visibility: (section: string, itemId: string) => `vis:${section}:${itemId}`,
}

export function allProposalKeys(r: TailorResult): string[] {
    return [
        ...(r.summary ? [proposalKey.summary()] : []),
        ...r.bulletRewrites.map((b) => proposalKey.bullet(b.section, b.itemId, b.bulletIndex)),
        ...r.visibility.map((v) => proposalKey.visibility(v.section, v.itemId)),
    ]
}

function itemsFor(doc: CvDoc, section: string): { id: string; hidden: boolean; highlights: string[] }[] {
    if (section === 'work') return doc.work
    if (section === 'projects') return doc.projects
    if (section === 'education') return doc.education
    return []
}

/** Returns a new doc with only the selected proposals applied. */
export function applyTailor(doc: CvDoc, r: TailorResult, selected: Set<string>): CvDoc {
    const next = structuredClone(doc)
    if (r.summary && selected.has(proposalKey.summary())) next.basics.summary = r.summary.text
    for (const b of r.bulletRewrites) {
        if (!selected.has(proposalKey.bullet(b.section, b.itemId, b.bulletIndex))) continue
        const item = itemsFor(next, b.section).find((x) => x.id === b.itemId)
        if (item && b.bulletIndex < item.highlights.length) item.highlights[b.bulletIndex] = b.text
    }
    for (const v of r.visibility) {
        if (!selected.has(proposalKey.visibility(v.section, v.itemId))) continue
        const item = itemsFor(next, v.section).find((x) => x.id === v.itemId)
        if (item) item.hidden = v.hide
    }
    return next
}

/** Lookup helpers for rendering "before" text next to a proposal. */
export function itemLabel(doc: CvDoc, section: string, itemId: string): string {
    if (section === 'work') {
        const w = doc.work.find((x) => x.id === itemId)
        return w ? [w.position, w.name].filter(Boolean).join(' · ') : itemId
    }
    if (section === 'projects') return doc.projects.find((x) => x.id === itemId)?.name ?? itemId
    const e = doc.education.find((x) => x.id === itemId)
    return e ? [e.studyType, e.institution].filter(Boolean).join(' · ') : itemId
}

export function originalBullet(doc: CvDoc, section: string, itemId: string, index: number): string {
    return itemsFor(doc, section).find((x) => x.id === itemId)?.highlights[index] ?? ''
}
