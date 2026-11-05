import { Section, baseCss, contactItems, cssVars, visibleSections } from './shared'
import type { ThemeDef, ThemeProps } from './types'

/**
 * Classic: single column, serif headings, accent rule under section titles.
 * Styles are inlined (scoped under .cv-classic) so preview and the
 * Playwright print route render identically without extra CSS loading.
 */
const R = '.cv-classic'
const css = `${baseCss(R)}
${R} h1 { font-family: var(--cv-font-heading); font-size: 2.3em; line-height: 1.1; font-weight: 700; letter-spacing: -0.01em; }
${R} .label { font-size: 1.15em; color: var(--cv-accent); margin-top: 0.15em; }
${R} .contact { display: flex; flex-wrap: wrap; gap: 0.2em 0.9em; margin-top: 0.5em; color: var(--cv-muted); font-size: 0.92em; }
${R} header { margin-bottom: var(--cv-gap); }
${R} section { margin-top: var(--cv-gap); }
${R} h2 { font-family: var(--cv-font-heading); font-size: 1.15em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--cv-accent); margin-bottom: 0.5em; padding-bottom: 0.2em; border-bottom: 1.5px solid var(--cv-accent); }
${R} .item { margin-bottom: 0.75em; }
${R} .item:last-child { margin-bottom: 0; }
`

function Classic({ doc, tokens }: ThemeProps) {
    const b = doc.basics
    const contact = contactItems(doc)
    return (
        <div className="cv-classic" style={cssVars(tokens)}>
            <style>{css}</style>
            <header>
                <h1>{b.name || 'Your Name'}</h1>
                {b.label && <div className="label">{b.label}</div>}
                {contact.length > 0 && <div className="contact">{contact}</div>}
            </header>
            {visibleSections(doc).map((k) => (
                <Section key={k} doc={doc} sectionKey={k} />
            ))}
        </div>
    )
}

export const classicTheme: ThemeDef = {
    id: 'classic',
    name: 'Classic',
    description: 'Single column, serif headings, ATS-friendly.',
    defaults: {
        fontBody: 'Inter',
        fontHeading: 'Source Serif',
        fontSize: 10,
        lineHeight: 1.4,
        accent: '#1f4e79',
        text: '#1a1a1a',
        muted: '#555555',
        pageSize: 'A4',
        marginMm: 16,
        sectionGap: 1.1,
    },
    Component: Classic,
}
