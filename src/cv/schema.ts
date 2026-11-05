import { z } from 'zod'

/**
 * CvDoc — the single source of truth for CV content.
 * Field names follow the JSON Resume schema (jsonresume.org) where one exists,
 * plus `id`/`hidden` on items and a `meta` block for layout choices.
 * Dates are free-form strings, normally "YYYY" or "YYYY-MM".
 */

const id = z.string().min(1)
const str = z.string().default('')

export const profileSchema = z.object({
    id,
    network: str,
    username: str,
    url: str,
})

export const basicsSchema = z.object({
    name: str,
    label: str,
    email: str,
    phone: str,
    url: str,
    location: str,
    summary: str,
    profiles: z.array(profileSchema).default([]),
})

export const workSchema = z.object({
    id,
    hidden: z.boolean().default(false),
    name: str,
    position: str,
    location: str,
    url: str,
    startDate: str,
    endDate: str,
    summary: str,
    highlights: z.array(z.string()).default([]),
})

export const educationSchema = z.object({
    id,
    hidden: z.boolean().default(false),
    institution: str,
    area: str,
    studyType: str,
    location: str,
    startDate: str,
    endDate: str,
    score: str,
    highlights: z.array(z.string()).default([]),
})

export const projectSchema = z.object({
    id,
    hidden: z.boolean().default(false),
    name: str,
    url: str,
    startDate: str,
    endDate: str,
    description: str,
    highlights: z.array(z.string()).default([]),
})

export const skillSchema = z.object({
    id,
    hidden: z.boolean().default(false),
    name: str,
    keywords: z.array(z.string()).default([]),
})

export const certificateSchema = z.object({
    id,
    hidden: z.boolean().default(false),
    name: str,
    issuer: str,
    date: str,
    url: str,
})

export const languageSchema = z.object({
    id,
    hidden: z.boolean().default(false),
    language: str,
    fluency: str,
})

export const customItemSchema = z.object({
    id,
    hidden: z.boolean().default(false),
    title: str,
    subtitle: str,
    date: str,
    description: str,
})

export const customSectionSchema = z.object({
    id,
    title: str,
    items: z.array(customItemSchema).default([]),
})

export const BUILTIN_SECTIONS = [
    'summary',
    'work',
    'education',
    'projects',
    'skills',
    'certificates',
    'languages',
] as const
export type BuiltinSection = (typeof BUILTIN_SECTIONS)[number]

/** Section keys are builtin names or `custom:<id>`. */
export type SectionKey = BuiltinSection | `custom:${string}`

export const DEFAULT_SECTION_TITLES: Record<BuiltinSection, string> = {
    summary: 'Summary',
    work: 'Experience',
    education: 'Education',
    projects: 'Projects',
    skills: 'Skills',
    certificates: 'Certifications',
    languages: 'Languages',
}

export const metaSchema = z.object({
    sectionOrder: z.array(z.string()).default([...BUILTIN_SECTIONS]),
    hiddenSections: z.array(z.string()).default([]),
    sectionTitles: z.record(z.string(), z.string()).default({}),
})

export const cvDocSchema = z.object({
    basics: basicsSchema,
    work: z.array(workSchema).default([]),
    education: z.array(educationSchema).default([]),
    projects: z.array(projectSchema).default([]),
    skills: z.array(skillSchema).default([]),
    certificates: z.array(certificateSchema).default([]),
    languages: z.array(languageSchema).default([]),
    custom: z.array(customSectionSchema).default([]),
    meta: metaSchema,
})

export type CvDoc = z.infer<typeof cvDocSchema>
export type Work = z.infer<typeof workSchema>
export type Education = z.infer<typeof educationSchema>
export type Project = z.infer<typeof projectSchema>
export type Skill = z.infer<typeof skillSchema>
export type Certificate = z.infer<typeof certificateSchema>
export type Language = z.infer<typeof languageSchema>
export type CustomSection = z.infer<typeof customSectionSchema>
export type CustomItem = z.infer<typeof customItemSchema>
export type Profile = z.infer<typeof profileSchema>

export function emptyDoc(): CvDoc {
    return cvDocSchema.parse({ basics: {}, meta: {} })
}

export function sectionTitle(doc: CvDoc, key: string): string {
    const override = doc.meta.sectionTitles[key]
    if (override) return override
    if (key.startsWith('custom:')) {
        return doc.custom.find((c) => `custom:${c.id}` === key)?.title ?? 'Section'
    }
    return (DEFAULT_SECTION_TITLES as Record<string, string | undefined>)[key] ?? key
}

/** Section order with any missing keys appended (custom sections included). */
export function resolvedSectionOrder(doc: CvDoc): string[] {
    const all = [...BUILTIN_SECTIONS, ...doc.custom.map((c) => `custom:${c.id}`)]
    const order = doc.meta.sectionOrder.filter((k) => all.includes(k))
    for (const k of all) if (!order.includes(k)) order.push(k)
    return order
}
