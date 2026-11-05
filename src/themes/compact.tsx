import { Section, baseCss, contactItems, cssVars, visibleSections } from './shared'
import type { ThemeDef, ThemeProps } from './types'

/**
 * Compact: dense, single column, built to fit a lot on one page.
 * Name and contact share one header line; headings are small with a hairline.
 */
const R = '.cv-compact'
const css = `${baseCss(R)}
${R} header { display: flex; justify-content: space-between; align-items: flex-end; gap: 1em; padding-bottom: 0.4em; border-bottom: 2px solid var(--cv-accent); }
${R} h1 { font-family: var(--cv-font-heading); font-size: 1.9em; line-height: 1.05; font-weight: 700; }
${R} .label { color: var(--cv-accent); font-weight: 600; }
${R} .contact { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0 0.8em; font-size: 0.88em; color: var(--cv-muted); max-width: 55%; text-align: right; }
${R} section { margin-top: var(--cv-gap); }
${R} h2 { font-family: var(--cv-font-heading); font-size: 0.95em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--cv-accent); margin-bottom: 0.3em; padding-bottom: 0.1em; border-bottom: 0.5px solid color-mix(in srgb, var(--cv-accent) 45%, white); }
${R} .item { margin-bottom: 0.45em; }
${R} .item:last-child { margin-bottom: 0; }
${R} p { margin-top: 0.1em; }
${R} ul { margin-top: 0.1em; }
${R} li { margin: 0.05em 0; }
${R} .skills { gap: 0.1em 0.8em; }
`

function Compact({ doc, tokens }: ThemeProps) {
    const b = doc.basics
    const contact = contactItems(doc)
    return (
        <div className="cv-compact" style={cssVars(tokens)}>
            <style>{css}</style>
            <header>
                <div>
                    <h1>{b.name || 'Your Name'}</h1>
                    {b.label && <div className="label">{b.label}</div>}
                </div>
                {contact.length > 0 && <div className="contact">{contact}</div>}
            </header>
            {visibleSections(doc).map((k) => (
                <Section key={k} doc={doc} sectionKey={k} />
            ))}
        </div>
    )
}

export const compactTheme: ThemeDef = {
    id: 'compact',
    name: 'Compact',
    description: 'Dense single column for fitting everything on one page.',
    defaults: {
        fontBody: 'Inter',
        fontHeading: 'Inter',
        fontSize: 9,
        lineHeight: 1.3,
        accent: '#1e3a8a',
        text: '#111827',
        muted: '#4b5563',
        pageSize: 'A4',
        marginMm: 11,
        sectionGap: 0.75,
    },
    Component: Compact,
}
