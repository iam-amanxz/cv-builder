import { contactItems, cssVars } from './shared'
import type { CvDoc } from '#/cv/schema'
import type { ThemeTokens } from './types'

/**
 * Cover letter layout. Uses the CV's theme tokens (fonts, accent, size) so the
 * letter matches the CV it goes with.
 */
const R = '.cv-letter'
const css = `
${R} { color: var(--cv-text); font-family: var(--cv-font-body); font-size: calc(var(--cv-size) * 1.05); line-height: 1.55; }
${R} * { box-sizing: border-box; }
${R} a { color: inherit; text-decoration: none; }
${R} header { border-bottom: 2px solid var(--cv-accent); padding-bottom: 0.7em; margin-bottom: 2em; }
${R} h1 { font-family: var(--cv-font-heading); font-size: 1.9em; line-height: 1.1; margin: 0; font-weight: 700; }
${R} .label { color: var(--cv-accent); margin-top: 0.15em; }
${R} .contact { display: flex; flex-wrap: wrap; gap: 0.2em 0.9em; margin-top: 0.4em; color: var(--cv-muted); font-size: 0.88em; }
${R} .meta { margin-bottom: 1.6em; }
${R} .meta div { margin: 0.1em 0; }
${R} .date { color: var(--cv-muted); margin-bottom: 1em; }
${R} .re { font-weight: 600; margin-top: 1em; }
${R} p { margin: 0 0 1em; white-space: pre-line; }
`

export function Letter({
    doc,
    tokens,
    company,
    role,
    recipient,
    body,
    date,
}: {
    doc: CvDoc
    tokens: ThemeTokens
    company: string
    role: string
    recipient: string
    body: string
    date: string
}) {
    const contact = contactItems(doc)
    const paragraphs = body.split(/\n{2,}/).filter((p) => p.trim())
    return (
        <div className="cv-letter" style={cssVars(tokens)}>
            <style>{css}</style>
            <header>
                <h1>{doc.basics.name || 'Your Name'}</h1>
                {doc.basics.label && <div className="label">{doc.basics.label}</div>}
                {contact.length > 0 && <div className="contact">{contact}</div>}
            </header>
            <div className="meta">
                <div className="date">{date}</div>
                {recipient && <div>{recipient}</div>}
                {company && <div>{company}</div>}
                {role && <div className="re">Re: {role}</div>}
            </div>
            {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
            ))}
        </div>
    )
}

export function letterDate(d = new Date()): string {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
