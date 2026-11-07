import { sectionTitle } from '#/cv/schema'
import { displayUrl, formatRange } from '#/cv/format'
import { baseCss, contactItems, cssVars, sectionBody, visibleSections } from './shared'
import type { CvDoc } from '#/cv/schema'
import type { ThemeDef, ThemeProps } from './types'

/**
 * Airy: clean, minimal and breathable. A light, large name; a soft accent used
 * sparingly; small letter-spaced headings with a faint hairline; role and date
 * on one line with the organisation beneath; dot bullets; lots of white space.
 */
const R = '.cv-airy'
const css = `${baseCss(R)}
${R} header { margin-bottom: calc(var(--cv-gap) * 1.15); }
${R} h1 { font-family: var(--cv-font-heading); font-size: 2.7em; font-weight: 300; letter-spacing: -0.025em; line-height: 1.1; }
${R} .label { color: var(--cv-accent); font-size: 1.15em; margin-top: 0.35em; }
${R} .contact { display: flex; flex-wrap: wrap; gap: 0.15em 1.4em; margin-top: 0.9em; color: var(--cv-muted); font-size: 0.92em; }
${R} section { margin-top: var(--cv-gap); }
${R} h2 { display: flex; align-items: center; gap: 0.9em; margin-bottom: 0.9em; font-family: var(--cv-font-heading); font-size: 0.74em; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--cv-accent); }
${R} h2::after { content: ''; flex: 1; height: 1px; background: color-mix(in srgb, var(--cv-accent) 20%, transparent); }
${R} .sec-summary p { font-size: 1.02em; }
${R} .entry { margin-top: 1.15em; }
${R} .entry .top, ${R} .entry .where { break-after: avoid; }
${R} li { break-inside: avoid; }
${R} .entry:first-of-type { margin-top: 0; }
${R} .entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 1em; }
${R} .role { font-weight: 600; font-size: 1.05em; }
${R} .when { color: var(--cv-muted); font-size: 0.88em; font-variant-numeric: tabular-nums; white-space: nowrap; }
${R} .where { color: var(--cv-muted); margin-top: 0.1em; }
${R} ul { list-style: none; padding-left: 0; margin-top: 0.55em; }
${R} li { position: relative; padding-left: 1.1em; margin: 0.3em 0; }
${R} li::before { content: ''; position: absolute; left: 0.15em; top: calc(var(--cv-lh) * 0.5em - 0.17em); width: 0.34em; height: 0.34em; border-radius: 50%; background: var(--cv-accent); opacity: 0.65; }
${R} .skills { gap: 0.45em 1.6em; }
${R} .skills dt { font-weight: 500; color: var(--cv-muted); }
${R} .item { margin-bottom: 0.7em; }
${R} .item:last-child { margin-bottom: 0; }
${R} .inline-list { gap: 0.3em 1.6em; }
`

function Entry({
    role,
    where,
    when,
    children,
}: {
    role: string
    where: string[]
    when: string
    children?: React.ReactNode
}) {
    const place = where
        .map((w) => w.trim())
        .filter(Boolean)
        .join(' · ')
    return (
        <div className="entry">
            <div className="top">
                <span className="role">{role || place}</span>
                {when && <span className="when">{when}</span>}
            </div>
            {role && place && <div className="where">{place}</div>}
            {children}
        </div>
    )
}

function Bullets({ items }: { items: string[] }) {
    const list = items.map((h) => h.trim()).filter(Boolean)
    return list.length ? (
        <ul>
            {list.map((h, i) => (
                <li key={i}>{h}</li>
            ))}
        </ul>
    ) : null
}

/** Work, education and projects get the airy entry layout; other sections use the shared markup. */
function body(doc: CvDoc, key: string): React.ReactNode {
    switch (key) {
        case 'work': {
            const items = doc.work.filter((w) => !w.hidden)
            return items.length
                ? items.map((w) => (
                      <Entry
                          key={w.id}
                          role={w.position}
                          where={[w.name, w.location]}
                          when={formatRange(w.startDate, w.endDate)}
                      >
                          {w.summary && <p>{w.summary}</p>}
                          <Bullets items={w.highlights} />
                      </Entry>
                  ))
                : null
        }
        case 'education': {
            const items = doc.education.filter((e) => !e.hidden)
            return items.length
                ? items.map((e) => (
                      <Entry
                          key={e.id}
                          role={[e.studyType, e.area].filter(Boolean).join(' in ')}
                          where={[e.institution, e.location]}
                          when={formatRange(e.startDate, e.endDate)}
                      >
                          {e.score && <p>{e.score}</p>}
                          <Bullets items={e.highlights} />
                      </Entry>
                  ))
                : null
        }
        case 'projects': {
            const items = doc.projects.filter((p) => !p.hidden)
            return items.length
                ? items.map((p) => (
                      <Entry
                          key={p.id}
                          role={p.name}
                          where={[p.url ? displayUrl(p.url) : '']}
                          when={formatRange(p.startDate, p.endDate, '')}
                      >
                          {p.description && <p>{p.description}</p>}
                          <Bullets items={p.highlights} />
                      </Entry>
                  ))
                : null
        }
        default:
            return sectionBody(doc, key)
    }
}

function Airy({ doc, tokens }: ThemeProps) {
    const b = doc.basics
    const contact = contactItems(doc)
    return (
        <div className="cv-airy" style={cssVars(tokens)}>
            <style>{css}</style>
            <header>
                <h1>{b.name || 'Your Name'}</h1>
                {b.label && <div className="label">{b.label}</div>}
                {contact.length > 0 && <div className="contact">{contact}</div>}
            </header>
            {visibleSections(doc).map((k) => {
                const content = body(doc, k)
                if (!content) return null
                return (
                    <section key={k} className={`sec-${k.replace(':', '-')}`}>
                        <h2>{sectionTitle(doc, k)}</h2>
                        {content}
                    </section>
                )
            })}
        </div>
    )
}

export const airyTheme: ThemeDef = {
    id: 'airy',
    name: 'Airy',
    description: 'Clean and breathable: light headline, soft sage accent, generous white space.',
    defaults: {
        fontBody: 'Inter',
        fontHeading: 'Inter',
        fontSize: 9.75,
        lineHeight: 1.55,
        accent: '#3f7d6e',
        text: '#1f2a2e',
        muted: '#6b7a80',
        pageSize: 'A4',
        marginMm: 20,
        sectionGap: 1.9,
    },
    Component: Airy,
}
