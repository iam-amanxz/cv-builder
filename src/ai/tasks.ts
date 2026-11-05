import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { cvDocSchema } from '#/cv/schema'
import { formatRange } from '#/cv/format'
import { createSnapshot } from '#/server/snapshots.server'
import { bulletsResultSchema, summaryResultSchema, tailorResultSchema } from './schemas'
import type { CvDoc } from '#/cv/schema'

/**
 * AI server functions. The client is imported lazily inside handlers so the
 * SDK never reaches the browser bundle.
 */

const HONESTY = `Only use facts already present in the CV. Never invent employers, titles, dates, metrics, tools or achievements. If a stronger claim would need information you do not have, say so instead of making it up.`

const STYLE = `Write in the CV owner's voice: implied first person (no "I"), past tense for past roles, present tense for the current one. Start bullets with a strong verb, lead with impact, keep each bullet to one or two lines, no buzzwords or filler.`

/** Compact text rendering of the CV with ids the model can refer back to. */
function cvAsText(doc: CvDoc): string {
    const lines: string[] = []
    const b = doc.basics
    lines.push(`Name: ${b.name}`, `Headline: ${b.label}`, `Location: ${b.location}`, '', `Summary: ${b.summary}`, '')
    for (const w of doc.work) {
        lines.push(
            `[work id=${w.id}${w.hidden ? ' HIDDEN' : ''}] ${w.position} · ${w.name} (${formatRange(w.startDate, w.endDate)})`,
        )
        if (w.summary) lines.push(`  summary: ${w.summary}`)
        w.highlights.forEach((h, i) => h.trim() && lines.push(`  b${i}: ${h.trim()}`))
    }
    for (const p of doc.projects) {
        lines.push(`[projects id=${p.id}${p.hidden ? ' HIDDEN' : ''}] ${p.name}: ${p.description}`)
        p.highlights.forEach((h, i) => h.trim() && lines.push(`  b${i}: ${h.trim()}`))
    }
    for (const e of doc.education) {
        lines.push(
            `[education id=${e.id}${e.hidden ? ' HIDDEN' : ''}] ${[e.studyType, e.area].filter(Boolean).join(' in ')} · ${e.institution}`,
        )
        e.highlights.forEach((h, i) => h.trim() && lines.push(`  b${i}: ${h.trim()}`))
    }
    const skills = doc.skills.filter((s) => !s.hidden)
    if (skills.length) {
        lines.push('', 'Skills:')
        for (const s of skills)
            lines.push(
                `  ${s.name}: ${s.keywords
                    .map((k) => k.trim())
                    .filter(Boolean)
                    .join(', ')}`,
            )
    }
    const certs = doc.certificates.filter((c) => !c.hidden)
    if (certs.length) lines.push('', `Certifications: ${certs.map((c) => c.name).join('; ')}`)
    return lines.join('\n')
}

async function ai() {
    return import('./client.server')
}

export const aiStatus = createServerFn({ method: 'GET' }).handler(async () => {
    const { aiConfigured, AI_MODEL } = await ai()
    return { configured: aiConfigured(), model: AI_MODEL }
})

/** Freeze the CV before an AI change is applied, so it can be undone from History. */
export const snapshotBeforeAi = createServerFn({ method: 'POST' })
    .validator(z.object({ variantId: z.string(), label: z.string().max(120) }))
    .handler(async ({ data }) => {
        const { id } = createSnapshot(data.variantId, 'ai-apply', data.label)
        return { id }
    })

export const improveBullets = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            variantId: z.string(),
            role: z.string().max(200),
            organisation: z.string().max(200),
            bullets: z.array(z.string().max(1000)).min(1).max(30),
        }),
    )
    .handler(async ({ data }) => {
        const { runStructured } = await ai()
        const list = data.bullets.map((b, i) => `${i}. ${b}`).join('\n')
        return runStructured({
            kind: 'bullets',
            variantId: data.variantId,
            effort: 'medium',
            output: bulletsResultSchema,
            logInput: data,
            system: `You are an expert CV editor. Improve CV bullet points using the pattern: action verb + what was done + measurable impact. ${STYLE} ${HONESTY} Where a number would make a bullet much stronger but none is given, keep the claim unquantified and set needsNumber to true. Return one entry per input bullet, in order.`,
            prompt: `Role: ${data.role || 'unknown'}\nOrganisation: ${data.organisation || 'unknown'}\n\nBullets:\n${list}`,
        })
    })

export const suggestSummary = createServerFn({ method: 'POST' })
    .validator(z.object({ variantId: z.string(), doc: cvDocSchema, jobDescription: z.string().max(20000).optional() }))
    .handler(async ({ data }) => {
        const { runStructured } = await ai()
        const jd = data.jobDescription?.trim()
        return runStructured({
            kind: 'summary',
            variantId: data.variantId,
            effort: 'medium',
            output: summaryResultSchema,
            logInput: { variantId: data.variantId, jobDescription: jd },
            system: `You write professional summaries for the top of a CV. ${STYLE} ${HONESTY} Give exactly three options with different emphasis (e.g. leadership, technical depth, domain impact).`,
            prompt: `CV:\n${cvAsText(data.doc)}${jd ? `\n\nTarget job description:\n${jd}` : ''}`,
        })
    })

export const tailorToJob = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            variantId: z.string(),
            doc: cvDocSchema,
            jobDescription: z.string().trim().min(40, 'Paste the full job description').max(20000),
        }),
    )
    .handler(async ({ data }) => {
        const { runStructured } = await ai()
        const res = await runStructured({
            kind: 'tailor',
            variantId: data.variantId,
            effort: 'high',
            output: tailorResultSchema,
            logInput: { variantId: data.variantId, jobDescription: data.jobDescription },
            system: `You tailor a CV to a specific job. Propose a small set of high-value edits, not a rewrite of everything.
- Rewrite bullets (by item id and bullet index b0, b1, …) only where rephrasing makes existing experience match the job's language and priorities better.
- Suggest hiding items that are irrelevant to this job, and showing HIDDEN items that are relevant.
- Optionally rewrite the summary for this job.
- List job keywords the CV already shows and important ones it is missing. Missing keywords are information for the candidate, not something to insert.
${STYLE} ${HONESTY}`,
            prompt: `CV:\n${cvAsText(data.doc)}\n\nJob description:\n${data.jobDescription}`,
        })
        // Drop proposals that point at things that don't exist.
        const ids = new Map<string, string[]>([
            ['work', data.doc.work.map((w) => w.id)],
            ['projects', data.doc.projects.map((p) => p.id)],
            ['education', data.doc.education.map((e) => e.id)],
        ])
        const bulletsOf = (section: string, id: string): string[] => {
            const list =
                section === 'work' ? data.doc.work : section === 'projects' ? data.doc.projects : data.doc.education
            return list.find((x) => x.id === id)?.highlights ?? []
        }
        return {
            ...res,
            matchScore: Math.max(0, Math.min(100, Math.round(res.matchScore))),
            bulletRewrites: res.bulletRewrites.filter(
                (r) =>
                    ids.get(r.section)?.includes(r.itemId) &&
                    r.bulletIndex >= 0 &&
                    r.bulletIndex < bulletsOf(r.section, r.itemId).length &&
                    r.text.trim() !== bulletsOf(r.section, r.itemId)[r.bulletIndex].trim(),
            ),
            visibility: res.visibility.filter((v) => ids.get(v.section)?.includes(v.itemId)),
        }
    })

export const aiUsage = createServerFn({ method: 'GET' }).handler(async () => {
    const db = getDb()
    const { aiRuns } = schema
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const totals = (since?: Date) =>
        db
            .select({
                runs: sql<number>`count(*)`,
                cost: sql<number>`coalesce(sum(${aiRuns.costUsd}), 0)`,
                inputTokens: sql<number>`coalesce(sum(${aiRuns.inputTokens}), 0)`,
                outputTokens: sql<number>`coalesce(sum(${aiRuns.outputTokens}), 0)`,
            })
            .from(aiRuns)
            .where(since ? and(gte(aiRuns.createdAt, since)) : undefined)
            .get()
    const recent = db
        .select({
            id: aiRuns.id,
            kind: aiRuns.kind,
            model: aiRuns.model,
            status: aiRuns.status,
            error: aiRuns.error,
            inputTokens: aiRuns.inputTokens,
            outputTokens: aiRuns.outputTokens,
            costUsd: aiRuns.costUsd,
            durationMs: aiRuns.durationMs,
            createdAt: aiRuns.createdAt,
        })
        .from(aiRuns)
        .orderBy(desc(aiRuns.createdAt))
        .limit(50)
        .all()
    return { month: totals(monthStart), allTime: totals(), recent }
})

/**
 * Apply accepted AI proposals. The client builds the new doc from the
 * proposals the user ticked; this either snapshots + updates the CV, or
 * saves the result as a new CV (the original is untouched).
 */
export const applyAiDoc = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            variantId: z.string(),
            doc: cvDocSchema,
            mode: z.enum(['current', 'new']),
            name: z.string().trim().min(1).max(100).optional(),
            label: z.string().max(120),
        }),
    )
    .handler(async ({ data }) => {
        const db = getDb()
        const { variants } = schema
        if (data.mode === 'current') {
            createSnapshot(data.variantId, 'ai-apply', data.label)
            db.update(variants)
                .set({ doc: data.doc, updatedAt: new Date() })
                .where(eq(variants.id, data.variantId))
                .run()
            return { id: data.variantId }
        }
        const src = db.select().from(variants).where(eq(variants.id, data.variantId)).get()
        if (!src) throw new Error('CV not found')
        const id = nanoid(10)
        db.insert(variants)
            .values({
                id,
                name: data.name ?? `${src.name} (tailored)`,
                parentId: src.id,
                doc: data.doc,
                themeId: src.themeId,
                themeOverrides: src.themeOverrides,
                updatedAt: new Date(),
            })
            .run()
        return { id }
    })
