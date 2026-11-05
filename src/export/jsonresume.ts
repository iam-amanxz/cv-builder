import type { CvDoc } from '#/cv/schema'

/**
 * JSON Resume (jsonresume.org, schema v1) export. Hidden items are left out;
 * internal ids and layout settings are dropped. Custom sections have no
 * JSON Resume equivalent and go under the non-standard `x-custom` key.
 */
export function toJsonResume(doc: CvDoc, lastModified: Date) {
    const visible = <T extends { hidden: boolean }>(xs: T[]) => xs.filter((x) => !x.hidden)
    const strip = <T extends { id: string; hidden: boolean }>({ id: _id, hidden: _h, ...rest }: T) => rest
    const nonEmpty = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean)
    const hidden = new Set(doc.meta.hiddenSections)
    const section = <T>(key: string, value: T[]): T[] | undefined =>
        hidden.has(key) || !value.length ? undefined : value

    const b = doc.basics
    return {
        $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
        basics: {
            name: b.name,
            label: b.label,
            email: b.email,
            phone: b.phone,
            url: b.url,
            summary: hidden.has('summary') ? undefined : b.summary,
            location: b.location ? { address: b.location } : undefined,
            profiles: b.profiles.map(({ id: _id, ...p }) => p),
        },
        work: section(
            'work',
            visible(doc.work).map((w) => ({ ...strip(w), highlights: nonEmpty(w.highlights) })),
        ),
        education: section(
            'education',
            visible(doc.education).map((e) => ({
                ...strip(e),
                courses: nonEmpty(e.highlights),
                highlights: undefined,
            })),
        ),
        projects: section(
            'projects',
            visible(doc.projects).map((p) => ({ ...strip(p), highlights: nonEmpty(p.highlights) })),
        ),
        skills: section(
            'skills',
            visible(doc.skills).map((s) => ({ ...strip(s), keywords: nonEmpty(s.keywords) })),
        ),
        certificates: section('certificates', visible(doc.certificates).map(strip)),
        languages: section('languages', visible(doc.languages).map(strip)),
        'x-custom': doc.custom
            .filter((c) => !hidden.has(`custom:${c.id}`))
            .map((c) => ({ title: c.title, items: visible(c.items).map(strip) }))
            .filter((c) => c.items.length),
        meta: { version: 'v1.0.0', lastModified: lastModified.toISOString() },
    }
}
