import { nanoid } from 'nanoid'
import { z } from 'zod'
import { cvDocSchema } from './schema'
import type { CvDoc } from './schema'

/**
 * Shape the AI extracts from an uploaded CV: CvDoc minus ids, visibility and
 * layout settings. Kept flat and string-typed so it maps 1:1 onto CvDoc.
 */
const s = z.string()
export const extractedCvSchema = z.object({
    basics: z.object({
        name: s,
        label: s.describe('Headline / current title'),
        email: s,
        phone: s,
        url: s.describe('Personal website'),
        location: s,
        summary: s,
        profiles: z.array(z.object({ network: s, url: s })),
    }),
    work: z.array(
        z.object({
            name: s.describe('Company'),
            position: s,
            location: s,
            startDate: s.describe('YYYY-MM or YYYY; empty if unknown'),
            endDate: s.describe('YYYY-MM or YYYY; empty if current'),
            summary: s,
            highlights: z.array(s),
        }),
    ),
    education: z.array(
        z.object({
            institution: s,
            studyType: s.describe('Degree, e.g. BSc'),
            area: s.describe('Field of study'),
            startDate: s,
            endDate: s,
            score: s,
            highlights: z.array(s),
        }),
    ),
    projects: z.array(z.object({ name: s, url: s, description: s, highlights: z.array(s) })),
    skills: z.array(z.object({ name: s.describe('Group name'), keywords: z.array(s) })),
    certificates: z.array(z.object({ name: s, issuer: s, date: s })),
    languages: z.array(z.object({ language: s, fluency: s })),
    other: z
        .array(
            z.object({
                title: s.describe('Section heading, e.g. Awards, Publications, Volunteering'),
                items: z.array(z.object({ title: s, subtitle: s, date: s, description: s })),
            }),
        )
        .describe('Any sections that do not fit the ones above'),
})
export type ExtractedCv = z.infer<typeof extractedCvSchema>

const withIds = <T extends object>(xs: T[]) => xs.map((x) => ({ ...x, id: nanoid(8) }))

export function docFromExtracted(x: ExtractedCv): CvDoc {
    return cvDocSchema.parse({
        basics: { ...x.basics, profiles: withIds(x.basics.profiles) },
        work: withIds(x.work),
        education: withIds(x.education),
        projects: withIds(x.projects),
        skills: withIds(x.skills),
        certificates: withIds(x.certificates.map((c) => ({ ...c, url: '' }))),
        languages: withIds(x.languages),
        custom: x.other.map((o) => ({ id: nanoid(8), title: o.title, items: withIds(o.items) })),
        meta: {},
    })
}

/* ---------- JSON Resume (no AI needed) ---------- */

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const arr = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : []
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const date = (v: unknown) => str(v).slice(0, 7)

export function looksLikeJsonResume(v: unknown): boolean {
    return typeof v === 'object' && v !== null && 'basics' in v
}

/** Map a JSON Resume document (also this app's own JSON export) to a CvDoc. */
export function docFromJsonResume(j: Record<string, unknown>): CvDoc {
    const b = (j.basics ?? {}) as Record<string, unknown>
    const loc = b.location
    const location =
        typeof loc === 'string'
            ? loc
            : typeof loc === 'object' && loc
              ? [
                    str((loc as Record<string, unknown>).address),
                    str((loc as Record<string, unknown>).city),
                    str((loc as Record<string, unknown>).region),
                    str((loc as Record<string, unknown>).countryCode),
                ]
                    .filter(Boolean)
                    .join(', ')
              : ''
    return cvDocSchema.parse({
        basics: {
            name: str(b.name),
            label: str(b.label),
            email: str(b.email),
            phone: str(b.phone),
            url: str(b.url),
            location,
            summary: str(b.summary),
            profiles: arr(b.profiles).map((p) => ({
                id: nanoid(8),
                network: str(p.network),
                username: str(p.username),
                url: str(p.url),
            })),
        },
        work: arr(j.work).map((w) => ({
            id: nanoid(8),
            name: str(w.name) || str(w.company),
            position: str(w.position),
            location: str(w.location),
            url: str(w.url),
            startDate: date(w.startDate),
            endDate: date(w.endDate),
            summary: str(w.summary),
            highlights: strs(w.highlights),
        })),
        education: arr(j.education).map((e) => ({
            id: nanoid(8),
            institution: str(e.institution),
            area: str(e.area),
            studyType: str(e.studyType),
            startDate: date(e.startDate),
            endDate: date(e.endDate),
            score: str(e.score),
            highlights: [...strs(e.courses), ...strs(e.highlights)],
        })),
        projects: arr(j.projects).map((p) => ({
            id: nanoid(8),
            name: str(p.name),
            url: str(p.url),
            startDate: date(p.startDate),
            endDate: date(p.endDate),
            description: str(p.description),
            highlights: strs(p.highlights),
        })),
        skills: arr(j.skills).map((sk) => ({ id: nanoid(8), name: str(sk.name), keywords: strs(sk.keywords) })),
        certificates: arr(j.certificates).map((c) => ({
            id: nanoid(8),
            name: str(c.name),
            issuer: str(c.issuer),
            date: date(c.date),
            url: str(c.url),
        })),
        languages: arr(j.languages).map((l) => ({ id: nanoid(8), language: str(l.language), fluency: str(l.fluency) })),
        custom: [
            ...(arr(j.awards).length
                ? [
                      {
                          id: nanoid(8),
                          title: 'Awards',
                          items: arr(j.awards).map((a) => ({
                              id: nanoid(8),
                              title: str(a.title),
                              subtitle: str(a.awarder),
                              date: date(a.date),
                              description: str(a.summary),
                          })),
                      },
                  ]
                : []),
            ...arr(j['x-custom']).map((c) => ({
                id: nanoid(8),
                title: str(c.title),
                items: arr(c.items).map((i) => ({
                    id: nanoid(8),
                    title: str(i.title),
                    subtitle: str(i.subtitle),
                    date: str(i.date),
                    description: str(i.description),
                })),
            })),
        ],
        meta: {},
    })
}
