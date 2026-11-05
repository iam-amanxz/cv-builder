import { sectionTitle } from '#/cv/schema'
import { displayUrl, formatDate, formatRange, hrefFor } from '#/cv/format'
import { baseCss, cssVars, sectionBody, visibleSections } from './shared'
import type { CvDoc } from '#/cv/schema'
import type { ThemeDef, ThemeProps } from './types'

/**
 * Centered: the classic ATS-style résumé. Big centered uppercase name, bold
 * headline, pipe-separated contact line, large uppercase headings over a thin
 * rule; role on its own line, then "Company, Location" left and dates right;
 * skills and certifications as bullet lists.
 */
const R = '.cv-centered'
const css = `${baseCss(R)}
${R} header { text-align: center; margin-bottom: calc(var(--cv-gap) * 1.1); }
${R} h1 { font-family: var(--cv-font-heading); font-size: 3.1em; line-height: 1.05; font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em; color: var(--cv-accent); }
${R} .label { font-weight: 700; font-size: 1.1em; margin-top: 0.7em; }
${R} .contact { margin-top: 0.45em; }
${R} .contact .sep { margin: 0 0.35em; }
${R} section { margin-top: var(--cv-gap); }
${R} h2 { font-family: var(--cv-font-heading); font-size: 1.55em; font-weight: 700; text-transform: uppercase; color: var(--cv-accent); padding-bottom: 0.12em; border-bottom: 1px solid var(--cv-muted); margin-bottom: 0.4em; }
${R} .sec-summary p { text-align: justify; }
${R} .entry { margin-top: 0.75em; break-inside: avoid; }
${R} .entry:first-of-type { margin-top: 0; }
${R} .role { font-weight: 700; font-size: 1.12em; }
${R} .meta { display: flex; justify-content: space-between; gap: 1em; font-weight: 700; font-size: 0.92em; margin-top: 0.1em; }
${R} .meta .when { white-space: nowrap; }
${R} ul { padding-left: 1.6em; margin-top: 0.35em; }
${R} li { padding-left: 0.25em; }
${R} .sub, ${R} .date { color: inherit; }
${R} .item { margin-top: 0.6em; }
${R} .item:first-child { margin-top: 0; }
`

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
        .join(', ')
    return (
        <div className="entry">
            {role && <div className="role">{role}</div>}
            {(place || when) && (
                <div className="meta">
                    <span>{place}</span>
                    {when && <span className="when">{when}</span>}
                </div>
            )}
            {children}
        </div>
    )
}

/** Sections this theme lays out itself; the rest use the shared markup. */
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
                          when={formatRange(w.startDate, w.endDate, 'Present', 'long')}
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
                          role={[e.studyType, e.area].filter(Boolean).join(' of ')}
                          where={[e.institution, e.location]}
                          when={
                              e.endDate.trim() && !e.startDate.trim()
                                  ? `Graduated: ${formatDate(e.endDate, 'long')}`
                                  : formatRange(e.startDate, e.endDate, 'Present', 'long')
                          }
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
                          when={formatRange(p.startDate, p.endDate, '', 'long')}
                      >
                          {p.description && <p>{p.description}</p>}
                          <Bullets items={p.highlights} />
                      </Entry>
                  ))
                : null
        }
        case 'skills': {
            const items = doc.skills.filter((s) => !s.hidden)
            const lines = items
                .map((s) => ({
                    id: s.id,
                    name: s.name.trim(),
                    kw: s.keywords
                        .map((k) => k.trim())
                        .filter(Boolean)
                        .join(', '),
                }))
                .filter((s) => s.kw || s.name)
            return lines.length ? (
                <ul>
                    {lines.map((s) => (
                        <li key={s.id}>
                            {s.name && s.kw ? (
                                <>
                                    <b>{s.name}:</b> {s.kw}
                                </>
                            ) : (
                                s.kw || s.name
                            )}
                        </li>
                    ))}
                </ul>
            ) : null
        }
        case 'certificates': {
            const items = doc.certificates.filter((c) => !c.hidden && c.name.trim())
            return items.length ? (
                <ul>
                    {items.map((c) => (
                        <li key={c.id}>
                            {c.name}
                            {c.issuer && `, ${c.issuer}`}
                            {c.date && ` (${formatDate(c.date, 'long')})`}
                        </li>
                    ))}
                </ul>
            ) : null
        }
        case 'languages': {
            const items = doc.languages.filter((l) => !l.hidden && l.language.trim())
            return items.length ? (
                <ul>
                    {items.map((l) => (
                        <li key={l.id}>
                            {l.language}
                            {l.fluency && ` — ${l.fluency}`}
                        </li>
                    ))}
                </ul>
            ) : null
        }
        default:
            return sectionBody(doc, key)
    }
}

function Contact({ doc }: { doc: CvDoc }) {
    const b = doc.basics
    const parts: React.ReactNode[] = [
        b.location && <span key="loc">{b.location}</span>,
        b.email && (
            <a key="email" href={`mailto:${b.email}`}>
                {b.email}
            </a>
        ),
        b.phone && (
            <a key="phone" href={`tel:${b.phone.replace(/\s/g, '')}`}>
                {b.phone}
            </a>
        ),
        b.url && (
            <a key="url" href={hrefFor(b.url)}>
                {displayUrl(b.url)}
            </a>
        ),
        ...b.profiles
            .filter((p) => p.url)
            .map((p) => (
                <a key={p.id} href={hrefFor(p.url)}>
                    {displayUrl(p.url)}
                </a>
            )),
    ].filter(Boolean)
    if (!parts.length) return null
    return (
        <div className="contact">
            {parts.map((p, i) => (
                <span key={i}>
                    {i > 0 && <span className="sep">|</span>}
                    {p}
                </span>
            ))}
        </div>
    )
}

function Centered({ doc, tokens }: ThemeProps) {
    const b = doc.basics
    return (
        <div className="cv-centered" style={cssVars(tokens)}>
            <style>{css}</style>
            <header>
                <h1>{b.name || 'Your Name'}</h1>
                {b.label && <div className="label">{b.label}</div>}
                <Contact doc={doc} />
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

export const centeredTheme: ThemeDef = {
    id: 'centered',
    name: 'Centered',
    description: 'Classic ATS résumé: centered header, bold uppercase headings with rules.',
    defaults: {
        fontBody: 'Arial',
        fontHeading: 'Arial',
        fontSize: 10.5,
        lineHeight: 1.35,
        accent: '#000000',
        text: '#000000',
        muted: '#555555',
        pageSize: 'A4',
        marginMm: 14,
        sectionGap: 1.5,
    },
    Component: Centered,
}
