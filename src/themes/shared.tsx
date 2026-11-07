import { resolvedSectionOrder, sectionTitle } from '#/cv/schema'
import { displayUrl, formatDate, formatRange, hrefFor } from '#/cv/format'
import { fontStack } from './types'
import type { CvDoc } from '#/cv/schema'
import type { ThemeTokens } from './types'

/**
 * Markup shared by every theme. Themes differ by CSS (scoped under their
 * root class) and by how they arrange sections, not by content markup, so
 * every theme stays ATS-friendly: real text, logical reading order.
 *
 * Classes: section > h2, .item > .row > (.head > .title/.sub) + .date,
 * p, ul > li, dl.skills, .inline-list.
 */

export function cssVars(tokens: ThemeTokens): React.CSSProperties {
    return {
        '--cv-text': tokens.text,
        '--cv-muted': tokens.muted,
        '--cv-accent': tokens.accent,
        '--cv-font-body': fontStack(tokens.fontBody),
        '--cv-font-heading': fontStack(tokens.fontHeading),
        '--cv-size': `${tokens.fontSize}pt`,
        '--cv-lh': String(tokens.lineHeight),
        '--cv-gap': `${tokens.sectionGap}em`,
    } as React.CSSProperties
}

/** Reset + base rules every theme needs; prefix with the theme root class. */
export function baseCss(root: string): string {
    return `
${root} { color: var(--cv-text); font-family: var(--cv-font-body); font-size: var(--cv-size); line-height: var(--cv-lh); }
${root} * { box-sizing: border-box; }
${root} a { color: inherit; text-decoration: none; }
${root} h1, ${root} h2, ${root} p { margin: 0; }
${root} .item { break-inside: avoid; }
${root} h2 { break-after: avoid; }
${root} .row { display: flex; justify-content: space-between; gap: 1em; align-items: baseline; }
${root} .title { font-weight: 600; }
${root} .sub, ${root} .date { color: var(--cv-muted); }
${root} .date { white-space: nowrap; font-size: 0.92em; }
${root} p { margin-top: 0.25em; }
${root} ul { margin: 0.3em 0 0; padding-left: 1.15em; list-style: disc; }
${root} li { margin: 0.15em 0; }
${root} .skills { display: grid; grid-template-columns: max-content 1fr; gap: 0.25em 1em; margin: 0; }
${root} .skills dt { font-weight: 600; }
${root} .skills dd { margin: 0; }
${root} .inline-list { display: flex; flex-wrap: wrap; gap: 0.2em 1.2em; }
`
}

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

export function Link({ url, text }: { url: string; text?: string }) {
    if (!url) return null
    return <a href={hrefFor(url)}>{text ?? displayUrl(url)}</a>
}

function Item({
    title,
    sub,
    date,
    children,
}: {
    title: React.ReactNode
    sub?: React.ReactNode[]
    date: string
    children?: React.ReactNode
}) {
    const parts = (sub ?? []).filter(Boolean)
    return (
        <div className="item">
            <div className="row">
                <div className="head">
                    <span className="title">{title}</span>
                    {parts.map((s, i) => (
                        <span className="sub" key={i}>
                            {title || i > 0 ? ' · ' : ''}
                            {s}
                        </span>
                    ))}
                </div>
                {date && <span className="date">{date}</span>}
            </div>
            {children}
        </div>
    )
}

/** Contact entries for the header, in display order. */
export function contactItems(doc: CvDoc): React.ReactNode[] {
    const b = doc.basics
    return [
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
}

/** Visible section keys in the user's order. */
export function visibleSections(doc: CvDoc): string[] {
    const hidden = new Set(doc.meta.hiddenSections)
    return resolvedSectionOrder(doc).filter((k) => !hidden.has(k))
}

/** Section content without the wrapper; null when there is nothing to show. */
export function sectionBody(doc: CvDoc, key: string): React.ReactNode {
    switch (key) {
        case 'summary':
            return doc.basics.summary.trim() ? <p style={{ whiteSpace: 'pre-line' }}>{doc.basics.summary}</p> : null
        case 'work': {
            const items = doc.work.filter((w) => !w.hidden)
            if (!items.length) return null
            return items.map((w) => (
                <Item
                    key={w.id}
                    title={w.position}
                    sub={[w.name, w.location]}
                    date={formatRange(w.startDate, w.endDate)}
                >
                    {w.summary && <p>{w.summary}</p>}
                    <Bullets items={w.highlights} />
                </Item>
            ))
        }
        case 'education': {
            const items = doc.education.filter((e) => !e.hidden)
            if (!items.length) return null
            return items.map((e) => (
                <Item
                    key={e.id}
                    title={[e.studyType, e.area].filter(Boolean).join(' in ')}
                    sub={[e.institution, e.location]}
                    date={formatRange(e.startDate, e.endDate)}
                >
                    {e.score && <p className="sub">{e.score}</p>}
                    <Bullets items={e.highlights} />
                </Item>
            ))
        }
        case 'projects': {
            const items = doc.projects.filter((p) => !p.hidden)
            if (!items.length) return null
            return items.map((p) => (
                <Item
                    key={p.id}
                    title={p.name}
                    sub={[p.url && <Link url={p.url} />]}
                    date={formatRange(p.startDate, p.endDate, '')}
                >
                    {p.description && <p>{p.description}</p>}
                    <Bullets items={p.highlights} />
                </Item>
            ))
        }
        case 'skills': {
            const items = doc.skills.filter((s) => !s.hidden)
            if (!items.length) return null
            return (
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
            )
        }
        case 'certificates': {
            const items = doc.certificates.filter((c) => !c.hidden)
            if (!items.length) return null
            return items.map((c) => <Item key={c.id} title={c.name} sub={[c.issuer]} date={formatDate(c.date)} />)
        }
        case 'languages': {
            const items = doc.languages.filter((l) => !l.hidden)
            if (!items.length) return null
            return (
                <div className="inline-list">
                    {items.map((l) => (
                        <span key={l.id}>
                            <span className="title">{l.language}</span>
                            {l.fluency && <span className="sub"> ({l.fluency})</span>}
                        </span>
                    ))}
                </div>
            )
        }
        default: {
            const section = doc.custom.find((c) => `custom:${c.id}` === key)
            const items = section?.items.filter((i) => !i.hidden) ?? []
            if (!items.length) return null
            return items.map((i) => (
                <Item key={i.id} title={i.title} sub={[i.subtitle]} date={formatDate(i.date)}>
                    {i.description && <p style={{ whiteSpace: 'pre-line' }}>{i.description}</p>}
                </Item>
            ))
        }
    }
}

/** Renders a section with its heading, or nothing if it is empty. */
export function Section({ doc, sectionKey }: { doc: CvDoc; sectionKey: string }) {
    const body = sectionBody(doc, sectionKey)
    if (!body) return null
    return (
        <section className={`sec-${sectionKey.replace(':', '-')}`}>
            <h2>{sectionTitle(doc, sectionKey)}</h2>
            {body}
        </section>
    )
}
