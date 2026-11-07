import {
    AlignmentType,
    BorderStyle,
    Document,
    ExternalHyperlink,
    Packer,
    Paragraph,
    Tab,
    TabStopType,
    TextRun,
    convertMillimetersToTwip,
} from 'docx'
import { resolvedSectionOrder, sectionTitle } from '#/cv/schema'
import { displayUrl, formatDate, formatRange, hrefFor } from '#/cv/format'
import { FONT_FAMILIES, PAGE_SIZES } from '#/themes/types'
import type { CvDoc } from '#/cv/schema'
import type { ThemeTokens } from '#/themes/types'

/**
 * Word export. Deliberately a simple single-column, ATS-safe layout whatever
 * the theme: it carries the theme's fonts, accent colour, size, page setup
 * and section order, but not its visual layout (Word can't reproduce CSS).
 */

const hex = (c: string) => c.replace('#', '').slice(0, 6).toUpperCase()

export async function renderDocx(doc: CvDoc, t: ThemeTokens): Promise<Buffer> {
    const page = PAGE_SIZES[t.pageSize]
    const margin = convertMillimetersToTwip(t.marginMm)
    const contentWidth = convertMillimetersToTwip(page.widthMm) - 2 * margin
    const size = Math.round(t.fontSize * 2) // half-points
    const body = FONT_FAMILIES[t.fontBody] ?? t.fontBody
    const heading = FONT_FAMILIES[t.fontHeading] ?? t.fontHeading
    const accent = hex(t.accent)
    const muted = hex(t.muted)
    const gap = Math.round(t.fontSize * 20 * t.sectionGap) // twips
    const lineSpacing = Math.round(240 * t.lineHeight * 0.85)

    const out: Paragraph[] = []
    const b = doc.basics

    // Header
    out.push(
        new Paragraph({
            children: [new TextRun({ text: b.name || 'Your Name', bold: true, size: size * 2.2, font: heading })],
        }),
    )
    if (b.label) {
        out.push(new Paragraph({ children: [new TextRun({ text: b.label, color: accent, size: size * 1.15 })] }))
    }
    const contact: (TextRun | ExternalHyperlink)[] = []
    const addContact = (text: string, link?: string) => {
        if (!text) return
        if (contact.length) contact.push(new TextRun({ text: '  ·  ', color: muted }))
        contact.push(
            link
                ? new ExternalHyperlink({ link, children: [new TextRun({ text, color: muted })] })
                : new TextRun({ text, color: muted }),
        )
    }
    addContact(b.location)
    addContact(b.email, b.email && `mailto:${b.email}`)
    addContact(b.phone)
    addContact(b.url && displayUrl(b.url), b.url && hrefFor(b.url))
    for (const p of b.profiles) addContact(p.url ? displayUrl(p.url) : p.username, p.url && hrefFor(p.url))
    if (contact.length) out.push(new Paragraph({ children: contact, spacing: { before: 80 } }))

    const sectionHeading = (title: string) =>
        new Paragraph({
            keepNext: true,
            spacing: { before: gap, after: 80 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: accent, space: 2 } },
            children: [
                new TextRun({
                    text: title.toUpperCase(),
                    bold: true,
                    color: accent,
                    font: heading,
                    size: Math.round(size * 1.1),
                }),
            ],
        })

    const itemLine = (title: string, subs: string[], date: string) => {
        const runs: TextRun[] = []
        if (title) runs.push(new TextRun({ text: title, bold: true }))
        for (const s of subs.filter(Boolean)) {
            runs.push(new TextRun({ text: `${runs.length ? ' · ' : ''}${s}`, color: muted }))
        }
        if (date) runs.push(new TextRun({ children: [new Tab(), date], color: muted }))
        return new Paragraph({
            keepNext: true,
            spacing: { before: 100 },
            tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
            children: runs,
        })
    }
    const para = (text: string) =>
        text.trim()
            ? text.split('\n').map((line) => new Paragraph({ children: [new TextRun(line)], spacing: { before: 40 } }))
            : []
    const bullets = (items: string[]) =>
        items
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun(x)], spacing: { before: 20 } }))

    const hidden = new Set(doc.meta.hiddenSections)
    for (const key of resolvedSectionOrder(doc)) {
        if (hidden.has(key)) continue
        const block: Paragraph[] = []
        switch (key) {
            case 'summary':
                block.push(...para(doc.basics.summary))
                break
            case 'work':
                for (const w of doc.work.filter((x) => !x.hidden)) {
                    block.push(
                        itemLine(w.position, [w.name, w.location], formatRange(w.startDate, w.endDate)),
                        ...para(w.summary),
                        ...bullets(w.highlights),
                    )
                }
                break
            case 'education':
                for (const e of doc.education.filter((x) => !x.hidden)) {
                    block.push(
                        itemLine(
                            [e.studyType, e.area].filter(Boolean).join(' in '),
                            [e.institution, e.location],
                            formatRange(e.startDate, e.endDate),
                        ),
                        ...para(e.score),
                        ...bullets(e.highlights),
                    )
                }
                break
            case 'projects':
                for (const p of doc.projects.filter((x) => !x.hidden)) {
                    block.push(
                        itemLine(p.name, [p.url && displayUrl(p.url)], formatRange(p.startDate, p.endDate, '')),
                        ...para(p.description),
                        ...bullets(p.highlights),
                    )
                }
                break
            case 'skills':
                for (const s of doc.skills.filter((x) => !x.hidden)) {
                    const kw = s.keywords
                        .map((k) => k.trim())
                        .filter(Boolean)
                        .join(', ')
                    block.push(
                        new Paragraph({
                            spacing: { before: 40 },
                            children: [new TextRun({ text: s.name ? `${s.name}: ` : '', bold: true }), new TextRun(kw)],
                        }),
                    )
                }
                break
            case 'certificates':
                for (const c of doc.certificates.filter((x) => !x.hidden)) {
                    block.push(itemLine(c.name, [c.issuer], formatDate(c.date)))
                }
                break
            case 'languages': {
                const langs = doc.languages.filter((x) => !x.hidden)
                if (langs.length) {
                    block.push(
                        new Paragraph({
                            spacing: { before: 40 },
                            children: langs.flatMap((l, i) => [
                                new TextRun({ text: `${i ? '   ·   ' : ''}${l.language}`, bold: true }),
                                new TextRun({ text: l.fluency ? ` (${l.fluency})` : '', color: muted }),
                            ]),
                        }),
                    )
                }
                break
            }
            default: {
                const c = doc.custom.find((x) => `custom:${x.id}` === key)
                for (const i of c?.items.filter((x) => !x.hidden) ?? []) {
                    block.push(itemLine(i.title, [i.subtitle], formatDate(i.date)), ...para(i.description))
                }
            }
        }
        if (block.length) out.push(sectionHeading(sectionTitle(doc, key)), ...block)
    }

    const document = new Document({
        creator: b.name || 'CV Builder',
        title: [b.name, b.label].filter(Boolean).join(', ') || 'CV',
        styles: {
            default: {
                document: {
                    run: { font: body, size, color: hex(t.text) },
                    paragraph: { spacing: { line: lineSpacing } },
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        size: {
                            width: convertMillimetersToTwip(page.widthMm),
                            height: convertMillimetersToTwip(page.heightMm),
                        },
                        margin: { top: margin, bottom: margin, left: margin, right: margin },
                    },
                },
                children: out.length ? out : [new Paragraph({ alignment: AlignmentType.LEFT, children: [] })],
            },
        ],
    })
    return Packer.toBuffer(document)
}
