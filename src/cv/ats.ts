import { resolvedSectionOrder, sectionTitle } from './schema'
import { sectionBody } from '#/themes/shared'
import type { CvDoc } from './schema'

export type AtsStatus = 'pass' | 'warn' | 'fail'
export interface AtsCheck {
    id: string
    status: AtsStatus
    title: string
    detail: string
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
/** Letter-spaced headings can extract as "E X P E R I E N C E"; compare without whitespace. */
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/**
 * Checks the text an applicant tracking system would extract from the PDF.
 * Pure: takes the extracted text (pages in order) and the CV it came from.
 */
export function runAtsChecks(doc: CvDoc, pages: string[], themeId: string): AtsCheck[] {
    const text = pages.join('\n')
    const flat = norm(text)
    const tight = squash(text)
    const out: AtsCheck[] = []
    const add = (id: string, status: AtsStatus, title: string, detail: string) =>
        out.push({ id, status, title, detail })

    // 1. Text layer exists.
    if (flat.length < 200) {
        add('text', 'fail', 'Text could not be extracted', 'Parsers read almost nothing from this PDF.')
        return out
    }
    add('text', 'pass', 'Text is extractable', `${flat.length.toLocaleString()} characters read.`)

    // 2. Name near the top.
    const name = norm(doc.basics.name)
    if (!name) add('name', 'fail', 'No name', 'Add your full name in Personal details.')
    else if (tight.slice(0, 300).includes(squash(name))) add('name', 'pass', 'Name is at the top', doc.basics.name)
    else add('name', 'warn', 'Name not found at the top', 'Parsers expect the name first.')

    // 3. Contact details readable as text.
    const email = doc.basics.email.trim()
    if (!email) add('email', 'fail', 'No email address', 'Recruiters and ATS need an email.')
    else if (flat.includes(email.toLowerCase())) add('email', 'pass', 'Email is readable', email)
    else add('email', 'fail', 'Email not readable', 'The email address is not in the extracted text.')
    const phoneDigits = doc.basics.phone.replace(/\D/g, '')
    if (!phoneDigits) add('phone', 'warn', 'No phone number', 'Many forms require one.')
    else if (text.replace(/\D/g, '').includes(phoneDigits)) add('phone', 'pass', 'Phone is readable', doc.basics.phone)
    else add('phone', 'warn', 'Phone not readable as typed', 'Formatting may split the number.')

    // 4. Section headings present and in reading order.
    const hidden = new Set(doc.meta.hiddenSections)
    const expected = resolvedSectionOrder(doc)
        .filter((k) => !hidden.has(k) && sectionBody(doc, k) !== null)
        .map((k) => ({ key: k, title: sectionTitle(doc, k) }))
    // Headings are found as whole lines first, so a word like "experience" in
    // the summary doesn't count as the Experience heading.
    // Themes render headings in capitals, so an uppercase line is the best
    // match; this also skips e.g. a skill group that happens to be named "Languages".
    const rawLines = text.split('\n')
    const lines = rawLines.map(squash)
    const lineStart: number[] = []
    lines.reduce((acc, l, i) => ((lineStart[i] = acc), acc + l.length), 0)
    const isCaps = (l: string) => /[A-Z]/.test(l) && l === l.toUpperCase()
    const headingAt = (title: string) => {
        const t = squash(title)
        let i = lines.findIndex((l, j) => l === t && isCaps(rawLines[j]))
        if (i < 0) i = lines.findIndex((l) => l === t)
        return i >= 0 ? lineStart[i] : tight.indexOf(t)
    }
    const positions = expected.map((s) => ({ ...s, at: headingAt(s.title) }))
    const missing = positions.filter((p) => p.at < 0)
    if (missing.length) {
        add('headings', 'warn', 'Some headings not found', missing.map((m) => m.title).join(', '))
    } else {
        add('headings', 'pass', 'All section headings found', expected.map((s) => s.title).join(' · '))
    }
    const found = positions.filter((p) => p.at >= 0)
    const inOrder = found.every((p, i) => i === 0 || p.at > found[i - 1].at)
    if (!inOrder) {
        const read = [...found].sort((a, b) => a.at - b.at).map((p) => p.title)
        add(
            'order',
            'warn',
            'Reading order differs from your layout',
            `A parser reads: ${read.join(' → ')}.${themeId === 'modern' ? ' Two-column layouts often do this; use the Word export or a single-column theme for strict ATS portals.' : ''}`,
        )
    } else {
        add('order', 'pass', 'Reading order matches', 'Sections are read in the order you set.')
    }

    // 5. Standard headings help parsers classify sections.
    const STANDARD: Partial<Record<string, string[]>> = {
        work: ['experience', 'work experience', 'employment', 'professional experience', 'work history'],
        education: ['education'],
        skills: ['skills', 'technical skills', 'core skills'],
    }
    const odd = expected.filter((s) => {
        const names = STANDARD[s.key]
        return names !== undefined && !names.includes(norm(s.title))
    })
    if (odd.length) {
        add(
            'standard',
            'warn',
            'Non-standard heading names',
            odd.map((s) => `“${s.title}” — ATS look for e.g. “${STANDARD[s.key]?.[0]}”`).join('; '),
        )
    }

    // 6. Dates on every position.
    const undated = doc.work.filter((w) => !w.hidden && !w.startDate.trim())
    if (undated.length) {
        add('dates', 'warn', 'Positions without dates', undated.map((w) => w.position || w.name).join(', '))
    } else if (doc.work.some((w) => !w.hidden)) {
        add('dates', 'pass', 'Every position has dates', '')
    }

    // 7. Length.
    if (pages.length > 2) add('length', 'warn', `${pages.length} pages`, 'Most recruiters expect one or two pages.')
    else add('length', 'pass', `${pages.length} page${pages.length > 1 ? 's' : ''}`, '')

    return out
}
