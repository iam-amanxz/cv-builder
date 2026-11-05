import { Section, baseCss, contactItems, cssVars, visibleSections } from './shared'
import type { ThemeDef, ThemeProps } from './types'

/**
 * Minimal: lots of whitespace, no rules, dates in a left gutter.
 * Section headings sit in the gutter too, so the content column reads cleanly.
 */
const R = '.cv-minimal'
const GUTTER = '8.5em'
const css = `${baseCss(R)}
${R} header { margin-bottom: calc(var(--cv-gap) * 1.4); padding-left: ${GUTTER}; }
${R} h1 { font-family: var(--cv-font-heading); font-size: 2em; font-weight: 600; letter-spacing: -0.01em; }
${R} .label { color: var(--cv-muted); margin-top: 0.1em; font-size: 1.05em; }
${R} .contact { display: flex; flex-wrap: wrap; gap: 0.15em 1em; margin-top: 0.6em; font-size: 0.9em; color: var(--cv-accent); }
${R} section { position: relative; padding-left: ${GUTTER}; margin-top: var(--cv-gap); }
${R} h2 { position: absolute; left: 0; top: 0; width: calc(${GUTTER} - 1em); font-family: var(--cv-font-heading); font-size: 0.85em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--cv-accent); line-height: calc(var(--cv-lh) * 1.18); }
${R} .item { margin-bottom: 0.85em; }
${R} .item:last-child { margin-bottom: 0; }
${R} .item .row { display: block; }
${R} .item .date { display: block; font-size: 0.88em; }
`

function Minimal({ doc, tokens }: ThemeProps) {
    const b = doc.basics
    const contact = contactItems(doc)
    return (
        <div className="cv-minimal" style={cssVars(tokens)}>
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

export const minimalTheme: ThemeDef = {
    id: 'minimal',
    name: 'Minimal',
    description: 'Quiet and spacious, headings in a left gutter.',
    defaults: {
        fontBody: 'Inter',
        fontHeading: 'Inter',
        fontSize: 9.5,
        lineHeight: 1.5,
        accent: '#9a3412',
        text: '#1c1917',
        muted: '#78716c',
        pageSize: 'A4',
        marginMm: 18,
        sectionGap: 1.4,
    },
    Component: Minimal,
}
