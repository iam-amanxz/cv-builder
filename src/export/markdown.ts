import { resolvedSectionOrder, sectionTitle } from '#/cv/schema'
import { displayUrl, formatDate, formatRange } from '#/cv/format'
import type { CvDoc } from '#/cv/schema'

/** Plain Markdown version of the CV (hidden items/sections left out). */
export function renderMarkdown(doc: CvDoc): string {
    const b = doc.basics
    const out: string[] = [`# ${b.name || 'Your Name'}`]
    if (b.label) out.push(`**${b.label}**`)
    const contact = [
        b.location,
        b.email,
        b.phone,
        b.url && displayUrl(b.url),
        ...b.profiles.map((p) => (p.url ? displayUrl(p.url) : p.username)),
    ].filter(Boolean)
    if (contact.length) out.push(contact.join(' · '))

    const head = (title: string, subs: string[], date: string) => {
        const main = [title, ...subs.filter(Boolean)].filter(Boolean).join(' · ')
        return `### ${main}${date ? ` — _${date}_` : ''}`
    }
    const bullets = (xs: string[]) =>
        xs
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => `- ${x}`)
            .join('\n')

    const hidden = new Set(doc.meta.hiddenSections)
    for (const key of resolvedSectionOrder(doc)) {
        if (hidden.has(key)) continue
        const block: string[] = []
        switch (key) {
            case 'summary':
                if (b.summary.trim()) block.push(b.summary.trim())
                break
            case 'work':
                for (const w of doc.work.filter((x) => !x.hidden))
                    block.push(
                        [
                            head(w.position, [w.name, w.location], formatRange(w.startDate, w.endDate)),
                            w.summary.trim(),
                            bullets(w.highlights),
                        ]
                            .filter(Boolean)
                            .join('\n\n'),
                    )
                break
            case 'education':
                for (const e of doc.education.filter((x) => !x.hidden))
                    block.push(
                        [
                            head(
                                [e.studyType, e.area].filter(Boolean).join(' in '),
                                [e.institution, e.location],
                                formatRange(e.startDate, e.endDate),
                            ),
                            e.score.trim(),
                            bullets(e.highlights),
                        ]
                            .filter(Boolean)
                            .join('\n\n'),
                    )
                break
            case 'projects':
                for (const p of doc.projects.filter((x) => !x.hidden))
                    block.push(
                        [
                            head(p.name, [p.url && displayUrl(p.url)], formatRange(p.startDate, p.endDate, '')),
                            p.description.trim(),
                            bullets(p.highlights),
                        ]
                            .filter(Boolean)
                            .join('\n\n'),
                    )
                break
            case 'skills':
                for (const s of doc.skills.filter((x) => !x.hidden)) {
                    const kw = s.keywords
                        .map((k) => k.trim())
                        .filter(Boolean)
                        .join(', ')
                    block.push(s.name ? `- **${s.name}:** ${kw}` : `- ${kw}`)
                }
                break
            case 'certificates':
                for (const c of doc.certificates.filter((x) => !x.hidden))
                    block.push(
                        `- **${c.name}**${c.issuer ? ` · ${c.issuer}` : ''}${c.date ? ` — _${formatDate(c.date)}_` : ''}`,
                    )
                break
            case 'languages':
                for (const l of doc.languages.filter((x) => !x.hidden))
                    block.push(`- **${l.language}**${l.fluency ? ` — ${l.fluency}` : ''}`)
                break
            default: {
                const c = doc.custom.find((x) => `custom:${x.id}` === key)
                for (const i of c?.items.filter((x) => !x.hidden) ?? [])
                    block.push(
                        [head(i.title, [i.subtitle], formatDate(i.date)), i.description.trim()]
                            .filter(Boolean)
                            .join('\n\n'),
                    )
            }
        }
        if (block.length) {
            const list = ['skills', 'certificates', 'languages'].includes(key)
            out.push(`## ${sectionTitle(doc, key)}`, block.join(list ? '\n' : '\n\n'))
        }
    }
    return out.join('\n\n') + '\n'
}
