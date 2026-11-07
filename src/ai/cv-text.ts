import { formatRange } from '#/cv/format'
import type { CvDoc } from '#/cv/schema'

export /** Compact text rendering of the CV with ids the model can refer back to. */
function cvAsText(doc: CvDoc): string {
    const lines: string[] = []
    const b = doc.basics
    lines.push(`Name: ${b.name}`, `Headline: ${b.label}`, `Location: ${b.location}`, '', `Summary: ${b.summary}`, '')
    for (const w of doc.work) {
        lines.push(
            `[work id=${w.id}${w.hidden ? ' HIDDEN' : ''}] ${w.position} · ${w.name} (${formatRange(w.startDate, w.endDate)})`,
        )
        if (w.summary) lines.push(`  summary: ${w.summary}`)
        w.highlights.forEach((h, i) => h.trim() && lines.push(`  b${i}: ${h.trim()}`))
    }
    for (const p of doc.projects) {
        lines.push(`[projects id=${p.id}${p.hidden ? ' HIDDEN' : ''}] ${p.name}: ${p.description}`)
        p.highlights.forEach((h, i) => h.trim() && lines.push(`  b${i}: ${h.trim()}`))
    }
    for (const e of doc.education) {
        lines.push(
            `[education id=${e.id}${e.hidden ? ' HIDDEN' : ''}] ${[e.studyType, e.area].filter(Boolean).join(' in ')} · ${e.institution}`,
        )
        e.highlights.forEach((h, i) => h.trim() && lines.push(`  b${i}: ${h.trim()}`))
    }
    const skills = doc.skills.filter((s) => !s.hidden)
    if (skills.length) {
        lines.push('', 'Skills:')
        for (const s of skills)
            lines.push(
                `  ${s.name}: ${s.keywords
                    .map((k) => k.trim())
                    .filter(Boolean)
                    .join(', ')}`,
            )
    }
    const certs = doc.certificates.filter((c) => !c.hidden)
    if (certs.length) lines.push('', `Certifications: ${certs.map((c) => c.name).join('; ')}`)
    return lines.join('\n')
}

type Ref = { section: 'work' | 'projects' | 'education'; itemId: string; bulletIndex: number }

/**
 * Turn the model's bullet references into the bullet text, dropping any that
 * point at items or bullets that don't exist (so a made-up reference never shows).
 */
export function resolveEvidence(doc: CvDoc, refs: Ref[]): { where: string; text: string }[] {
    const out: { where: string; text: string }[] = []
    for (const r of refs) {
        const item =
            r.section === 'work'
                ? doc.work.find((w) => w.id === r.itemId)
                : r.section === 'projects'
                  ? doc.projects.find((p) => p.id === r.itemId)
                  : doc.education.find((e) => e.id === r.itemId)
        const text = item?.highlights[r.bulletIndex]?.trim()
        if (!item || !text || out.some((o) => o.text === text)) continue
        const where =
            'position' in item
                ? [item.position, item.name].filter(Boolean).join(' · ')
                : 'institution' in item
                  ? item.institution
                  : item.name
        out.push({ where, text })
    }
    return out
}
