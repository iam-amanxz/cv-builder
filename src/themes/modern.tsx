import { Section, baseCss, contactItems, cssVars, visibleSections } from './shared'
import type { ThemeDef, ThemeProps } from './types'

/**
 * Modern: two columns. A tinted sidebar carries contact details and the
 * short-list sections; the main column carries the narrative ones.
 * Section order is respected within each column.
 */
const SIDEBAR = new Set(['skills', 'languages', 'certificates'])

const R = '.cv-modern'
const css = `${baseCss(R)}
${R} header { border-left: 4px solid var(--cv-accent); padding-left: 0.9em; margin-bottom: calc(var(--cv-gap) * 1.2); }
${R} h1 { font-family: var(--cv-font-heading); font-size: 2.4em; line-height: 1.05; font-weight: 700; letter-spacing: -0.02em; }
${R} .label { font-size: 1.1em; color: var(--cv-accent); margin-top: 0.2em; font-weight: 500; }
${R} .cols { display: grid; grid-template-columns: 31% 1fr; gap: 1.6em; }
${R} aside { background: color-mix(in srgb, var(--cv-accent) 7%, white); border-radius: 6px; padding: 0.9em; align-self: start; }
${R} aside .contact { display: grid; gap: 0.25em; font-size: 0.92em; overflow-wrap: anywhere; }
${R} aside section, ${R} main section { margin-top: var(--cv-gap); }
${R} aside section:first-child, ${R} main section:first-child { margin-top: 0; }
${R} aside .skills { display: block; }
${R} aside .skills dt { margin-top: 0.4em; }
${R} aside .skills dt:first-child { margin-top: 0; }
${R} aside .inline-list { display: grid; gap: 0.2em; }
${R} aside .row { display: block; }
${R} aside .date { display: block; }
${R} h2 { font-family: var(--cv-font-heading); font-size: 0.95em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--cv-accent); margin-bottom: 0.55em; }
${R} .item { margin-bottom: 0.8em; }
${R} .item:last-child { margin-bottom: 0; }
${R} main .title { font-size: 1.05em; }
`

function Modern({ doc, tokens }: ThemeProps) {
    const b = doc.basics
    const contact = contactItems(doc)
    const keys = visibleSections(doc)
    return (
        <div className="cv-modern" style={cssVars(tokens)}>
            <style>{css}</style>
            <header>
                <h1>{b.name || 'Your Name'}</h1>
                {b.label && <div className="label">{b.label}</div>}
            </header>
            <div className="cols">
                <aside>
                    {contact.length > 0 && (
                        <section>
                            <h2>Contact</h2>
                            <div className="contact">{contact}</div>
                        </section>
                    )}
                    {keys
                        .filter((k) => SIDEBAR.has(k))
                        .map((k) => (
                            <Section key={k} doc={doc} sectionKey={k} />
                        ))}
                </aside>
                <main>
                    {keys
                        .filter((k) => !SIDEBAR.has(k))
                        .map((k) => (
                            <Section key={k} doc={doc} sectionKey={k} />
                        ))}
                </main>
            </div>
        </div>
    )
}

export const modernTheme: ThemeDef = {
    id: 'modern',
    name: 'Modern',
    description: 'Two columns with a tinted sidebar for contact and skills.',
    defaults: {
        fontBody: 'IBM Plex Sans',
        fontHeading: 'IBM Plex Sans',
        fontSize: 9.5,
        lineHeight: 1.4,
        accent: '#0f766e',
        text: '#18181b',
        muted: '#52525b',
        pageSize: 'A4',
        marginMm: 14,
        sectionGap: 1.2,
    },
    Component: Modern,
}
