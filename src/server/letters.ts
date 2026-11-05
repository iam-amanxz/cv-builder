import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { cvDocSchema } from '#/cv/schema'
import { resolveTokens } from '#/themes'

const { coverLetters, variants } = schema

export const listLetters = createServerFn({ method: 'GET' })
    .validator(z.object({ variantId: z.string() }))
    .handler(async ({ data }) =>
        getDb()
            .select()
            .from(coverLetters)
            .where(eq(coverLetters.variantId, data.variantId))
            .orderBy(desc(coverLetters.updatedAt))
            .all(),
    )

const letterInput = z.object({
    company: z.string().max(200),
    role: z.string().max(200),
    recipient: z.string().max(200),
    jobDescription: z.string().max(20000),
    body: z.string().max(20000),
})

export const createLetter = createServerFn({ method: 'POST' })
    .validator(z.object({ variantId: z.string() }).extend(letterInput.partial().shape))
    .handler(async ({ data }) => {
        const id = nanoid(10)
        getDb()
            .insert(coverLetters)
            .values({ ...data, id, updatedAt: new Date() })
            .run()
        return { id }
    })

export const updateLetter = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string() }).extend(letterInput.partial().shape))
    .handler(async ({ data }) => {
        const { id, ...patch } = data
        getDb()
            .update(coverLetters)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(coverLetters.id, id))
            .run()
        return { ok: true }
    })

export const deleteLetter = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        getDb().delete(coverLetters).where(eq(coverLetters.id, data.id)).run()
        return { ok: true }
    })

/** Letter + the CV it belongs to (for header details and theme). */
export const getLetterForPrint = createServerFn({ method: 'GET' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        const row = getDb()
            .select({ letter: coverLetters, variant: variants })
            .from(coverLetters)
            .innerJoin(variants, and(eq(variants.id, coverLetters.variantId)))
            .where(eq(coverLetters.id, data.id))
            .get()
        if (!row) throw new Error('Letter not found')
        return {
            letter: row.letter,
            doc: cvDocSchema.parse(row.variant.doc),
            tokens: resolveTokens(row.variant.themeId, row.variant.themeOverrides),
        }
    })

const letterResultSchema = z.object({
    greeting: z.string().describe('e.g. "Dear Hiring Manager," or "Dear Ms Smith,"'),
    paragraphs: z.array(z.string()).describe('3–4 paragraphs: hook, evidence from the CV, fit with the company, close'),
    signOff: z.string().describe('e.g. "Kind regards,"'),
})

export const generateLetter = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            variantId: z.string(),
            doc: cvDocSchema,
            company: z.string().max(200),
            role: z.string().max(200),
            recipient: z.string().max(200),
            jobDescription: z.string().trim().min(40, 'Paste the job description first').max(20000),
            tone: z.enum(['professional', 'warm', 'concise']),
        }),
    )
    .handler(async ({ data }) => {
        const { runStructured } = await import('#/ai/client.server')
        const d = data.doc
        const cv = [
            `${d.basics.name} — ${d.basics.label}`,
            d.basics.summary,
            ...d.work
                .filter((w) => !w.hidden)
                .map((w) => `${w.position} at ${w.name}: ${w.highlights.filter((h) => h.trim()).join(' | ')}`),
            ...d.projects.filter((p) => !p.hidden).map((p) => `Project ${p.name}: ${p.description}`),
            `Skills: ${d.skills
                .flatMap((s) => s.keywords.map((k) => k.trim()))
                .filter(Boolean)
                .join(', ')}`,
        ].join('\n')
        const res = await runStructured({
            kind: 'cover-letter',
            variantId: data.variantId,
            effort: 'medium',
            output: letterResultSchema,
            logInput: { company: data.company, role: data.role, tone: data.tone, jobDescription: data.jobDescription },
            system: `You write cover letters. Tone: ${data.tone}. Under 350 words. Open with why this role at this company, then two or three concrete achievements from the CV that match the job's priorities, then a short close. Plain, specific language — no clichés ("I am writing to express…", "passionate", "team player"). Only use facts from the CV; never invent experience, numbers or knowledge about the company beyond the job description.`,
            prompt: `Company: ${data.company || 'unknown'}\nRole: ${data.role || 'unknown'}\nRecipient: ${data.recipient || 'unknown'}\n\nCV:\n${cv}\n\nJob description:\n${data.jobDescription}`,
        })
        const body = [res.greeting, ...res.paragraphs, `${res.signOff}\n${d.basics.name}`].join('\n\n')
        return { body }
    })
