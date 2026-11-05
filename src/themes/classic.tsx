import { resolvedSectionOrder, sectionTitle } from '#/cv/schema'
import { displayUrl, formatDate, formatRange, hrefFor } from '#/cv/format'
import { fontStack } from './types'
import type { CvDoc } from '#/cv/schema'
import type { ThemeDef, ThemeProps } from './types'

/**
 * Classic: single column, serif headings, accent rule under section titles.
 * ATS-friendly: real text, logical reading order, no tables or icons.
 * Styles are inlined (scoped under .cv-classic) so preview and the
 * Playwright print route render identically without extra CSS loading.
 */
const css = `
.cv-classic { color: var(--cv-text); font-family: var(--cv-font-body); font-size: var(--cv-size); line-height: var(--cv-lh); }
.cv-classic * { box-sizing: border-box; }
.cv-classic a { color: inherit; text-decoration: none; }
.cv-classic h1 { font-family: var(--cv-font-heading); font-size: 2.3em; line-height: 1.1; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
.cv-classic .label { font-size: 1.15em; color: var(--cv-accent); margin-top: 0.15em; }
.cv-classic .contact { display: flex; flex-wrap: wrap; gap: 0.2em 0.9em; margin-top: 0.5em; color: var(--cv-muted); font-size: 0.92em; }
.cv-classic header { margin-bottom: var(--cv-gap); }
.cv-classic section { margin-top: var(--cv-gap); }
.cv-classic h2 { font-family: var(--cv-font-heading); font-size: 1.15em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--cv-accent); margin: 0 0 0.5em; padding-bottom: 0.2em; border-bottom: 1.5px solid var(--cv-accent); break-after: avoid; }
.cv-classic .item { margin-bottom: 0.75em; break-inside: avoid; }
.cv-classic .item:last-child { margin-bottom: 0; }
.cv-classic .row { display: flex; justify-content: space-between; gap: 1em; align-items: baseline; }
.cv-classic .title { font-weight: 600; }
.cv-classic .sub { color: var(--cv-muted); }
.cv-classic .date { color: var(--cv-muted); white-space: nowrap; font-size: 0.92em; }
.cv-classic p { margin: 0.25em 0 0; }
.cv-classic ul { margin: 0.3em 0 0; padding-left: 1.15em; list-style: disc; }
.cv-classic li { margin: 0.15em 0; }
.cv-classic .skills { display: grid; grid-template-columns: max-content 1fr; gap: 0.25em 1em; }
.cv-classic .skills dt { font-weight: 600; }
.cv-classic .skills dd { margin: 0; }
.cv-classic .inline-list { display: flex; flex-wrap: wrap; gap: 0.2em 1.2em; }
`

function Bullets({ items }: { items: string[] }) {
    const list = items.filter((h) => h.trim())
    if (!list.length) return null
    return (
        <ul>
            {list.map((h, i) => (
                <li key={i}>{h}</li>
            ))}
        </ul>
    )
}

function Link({ url, text }: { url: string; text?: string }) {
    if (!url) return null
    return <a href={hrefFor(url)}>{text ?? displayUrl(url)}</a>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    )
}

function renderSection(doc: CvDoc, key: string): React.ReactNode {
    const title = sectionTitle(doc, key)
    switch (key) {
        case 'summary':
            return doc.basics.summary.trim() ? (
                <Section title={title}>
                    <p style={{ whiteSpace: 'pre-line' }}>{doc.basics.summary}</p>
                </Section>
            ) : null
        case 'work': {
            const items = doc.work.filter((w) => !w.hidden)
            if (!items.length) return null
            return (
                <Section title={title}>
                    {items.map((w) => (
                        <div className="item" key={w.id}>
                            <div className="row">
                                <div>
                                    <span className="title">{w.position}</span>
                                    {w.name && (
                                        <span className="sub">
                                            {w.position ? ' · ' : ''}
                                            {w.name}
                                        </span>
                                    )}
                                    {w.location && <span className="sub"> · {w.location}</span>}
                                </div>
                                <span className="date">{formatRange(w.startDate, w.endDate)}</span>
                            </div>
                            {w.summary && <p>{w.summary}</p>}
                            <Bullets items={w.highlights} />
                        </div>
                    ))}
                </Section>
            )
        }
        case 'education': {
            const items = doc.education.filter((e) => !e.hidden)
            if (!items.length) return null
            return (
                <Section title={title}>
                    {items.map((e) => (
                        <div className="item" key={e.id}>
                            <div className="row">
                                <div>
                                    <span className="title">{[e.studyType, e.area].filter(Boolean).join(' in ')}</span>
                                    {e.institution && (
                                        <span className="sub">
                                            {e.studyType || e.area ? ' · ' : ''}
                                            {e.institution}
                                        </span>
                                    )}
                                    {e.location && <span className="sub"> · {e.location}</span>}
                                </div>
                                <span className="date">{formatRange(e.startDate, e.endDate)}</span>
                            </div>
                            {e.score && <p className="sub">{e.score}</p>}
                            <Bullets items={e.highlights} />
                        </div>
                    ))}
                </Section>
            )
        }
        case 'projects': {
            const items = doc.projects.filter((p) => !p.hidden)
            if (!items.length) return null
            return (
                <Section title={title}>
                    {items.map((p) => (
                        <div className="item" key={p.id}>
                            <div className="row">
                                <div>
                                    <span className="title">{p.name}</span>
                                    {p.url && (
                                        <span className="sub">
                                            {' · '}
                                            <Link url={p.url} />
                                        </span>
                                    )}
                                </div>
                                <span className="date">{formatRange(p.startDate, p.endDate, '')}</span>
                            </div>
                            {p.description && <p>{p.description}</p>}
                            <Bullets items={p.highlights} />
                        </div>
                    ))}
                </Section>
            )
        }
        case 'skills': {
            const items = doc.skills.filter((s) => !s.hidden)
            if (!items.length) return null
            return (
                <Section title={title}>
                    <dl className="skills">
                        {items.map((s) => (
                            <div key={s.id} style={{ display: 'contents' }}>
                                <dt>{s.name}</dt>
                                <dd>
                                    {s.keywords
                                        .map((k) => k.trim())
                                        .filter(Boolean)
                                        .join(', ')}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </Section>
            )
        }
        case 'certificates': {
            const items = doc.certificates.filter((c) => !c.hidden)
            if (!items.length) return null
            return (
                <Section title={title}>
                    {items.map((c) => (
                        <div className="item" key={c.id}>
                            <div className="row">
                                <div>
                                    <span className="title">{c.name}</span>
                                    {c.issuer && <span className="sub"> · {c.issuer}</span>}
                                </div>
                                <span className="date">{formatDate(c.date)}</span>
                            </div>
                        </div>
                    ))}
                </Section>
            )
        }
        case 'languages': {
            const items = doc.languages.filter((l) => !l.hidden)
            if (!items.length) return null
            return (
                <Section title={title}>
                    <div className="inline-list">
                        {items.map((l) => (
                            <span key={l.id}>
                                <span className="title">{l.language}</span>
                                {l.fluency && <span className="sub"> — {l.fluency}</span>}
                            </span>
                        ))}
                    </div>
                </Section>
            )
        }
        default: {
            const section = doc.custom.find((c) => `custom:${c.id}` === key)
            const items = section?.items.filter((i) => !i.hidden) ?? []
            if (!section || !items.length) return null
            return (
                <Section title={title}>
                    {items.map((i) => (
                        <div className="item" key={i.id}>
                            <div className="row">
                                <div>
                                    <span className="title">{i.title}</span>
                                    {i.subtitle && <span className="sub"> · {i.subtitle}</span>}
                                </div>
                                <span className="date">{formatDate(i.date)}</span>
                            </div>
                            {i.description && <p style={{ whiteSpace: 'pre-line' }}>{i.description}</p>}
                        </div>
                    ))}
                </Section>
            )
        }
    }
}

function Classic({ doc, tokens }: ThemeProps) {
    const b = doc.basics
    const contact = [
        b.location && <span key="loc">{b.location}</span>,
        b.email && <Link key="email" url={`mailto:${b.email}`} text={b.email} />,
        b.phone && <Link key="phone" url={`tel:${b.phone.replace(/\s/g, '')}`} text={b.phone} />,
        b.url && <Link key="url" url={b.url} />,
        ...b.profiles
            .filter((p) => p.url || p.username)
            .map((p) => (
                <Link key={p.id} url={p.url} text={p.url ? displayUrl(p.url) : `${p.network}: ${p.username}`} />
            )),
    ].filter(Boolean)

    const style = {
        '--cv-text': tokens.text,
        '--cv-muted': tokens.muted,
        '--cv-accent': tokens.accent,
        '--cv-font-body': fontStack(tokens.fontBody),
        '--cv-font-heading': fontStack(tokens.fontHeading),
        '--cv-size': `${tokens.fontSize}pt`,
        '--cv-lh': String(tokens.lineHeight),
        '--cv-gap': `${tokens.sectionGap}em`,
    } as React.CSSProperties

    const hidden = new Set(doc.meta.hiddenSections)

    return (
        <div className="cv-classic" style={style}>
            <style>{css}</style>
            <header>
                <h1>{b.name || 'Your Name'}</h1>
                {b.label && <div className="label">{b.label}</div>}
                {contact.length > 0 && <div className="contact">{contact}</div>}
            </header>
            {resolvedSectionOrder(doc)
                .filter((k) => !hidden.has(k))
                .map((k) => (
                    <div key={k}>{renderSection(doc, k)}</div>
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
