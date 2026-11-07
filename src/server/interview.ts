import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { cvDocSchema } from '#/cv/schema'
import { interviewResultSchema } from '#/ai/schemas'
import { cvAsText, resolveEvidence } from '#/ai/cv-text'
import type { InterviewPrep } from '#/ai/schemas'

const { interviewPreps, applications, variants } = schema

export const listPreps = createServerFn({ method: 'GET' })
    .validator(z.object({ variantId: z.string() }))
    .handler(async ({ data }) =>
        getDb()
            .select()
            .from(interviewPreps)
            .where(eq(interviewPreps.variantId, data.variantId))
            .orderBy(desc(interviewPreps.updatedAt))
            .all(),
    )

/**
 * New prep for a CV. Pre-filled from an application: the one given, or the
 * most recent one linked to this CV that has a job description.
 */
export const createPrep = createServerFn({ method: 'POST' })
    .validator(z.object({ variantId: z.string(), applicationId: z.string().optional() }))
    .handler(async ({ data }) => {
        const db = getDb()
        const app = data.applicationId
            ? db.select().from(applications).where(eq(applications.id, data.applicationId)).get()
            : db
                  .select()
                  .from(applications)
                  .where(and(eq(applications.variantId, data.variantId), ne(applications.jobDescription, '')))
                  .orderBy(desc(applications.updatedAt))
                  .get()
        const id = nanoid(10)
        db.insert(interviewPreps)
            .values({
                id,
                variantId: data.variantId,
                applicationId: app?.id ?? null,
                company: app?.company ?? '',
                role: app?.role ?? '',
                jobDescription: app?.jobDescription ?? '',
                updatedAt: new Date(),
            })
            .run()
        return { id }
    })

export const updatePrep = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            id: z.string(),
            company: z.string().max(200).optional(),
            role: z.string().max(200).optional(),
            jobDescription: z.string().max(30000).optional(),
            notes: z.string().max(30000).optional(),
        }),
    )
    .handler(async ({ data }) => {
        const { id, ...patch } = data
        getDb()
            .update(interviewPreps)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(interviewPreps.id, id))
            .run()
        return { ok: true }
    })

export const deletePrep = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        getDb().delete(interviewPreps).where(eq(interviewPreps.id, data.id)).run()
        return { ok: true }
    })

/** Ask the AI for questions, evidence, gaps and questions to ask; store the result on the prep. */
export const generatePrep = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }): Promise<InterviewPrep> => {
        const db = getDb()
        const prep = db.select().from(interviewPreps).where(eq(interviewPreps.id, data.id)).get()
        if (!prep) throw new Error('Interview prep not found')
        if (prep.jobDescription.trim().length < 40) throw new Error('Paste the job description first')
        const variant = db.select().from(variants).where(eq(variants.id, prep.variantId)).get()
        if (!variant) throw new Error('CV not found')
        const doc = cvDocSchema.parse(variant.doc)

        const { runStructured } = await import('#/ai/client.server')
        const { knownSkills, recordGaps } = await import('./gaps.server')
        const known = knownSkills()
        const res = await runStructured({
            kind: 'interview',
            variantId: prep.variantId,
            effort: 'high',
            output: interviewResultSchema,
            logInput: { prepId: prep.id, company: prep.company, role: prep.role },
            system: `You are an experienced interviewer and career coach preparing a candidate for an interview.
- Predict the questions this employer is most likely to ask, based on the job description: technical depth, system design, behavioural, leadership and role fit.
- For each question, point to the CV bullets that best answer it (by item id and bullet number) and outline a STAR answer built only from those bullets.
- List requirements the CV does not show. For each, give an honest way to answer (closest real experience, how the candidate would ramp up) and short preparation steps.
- Suggest sharp questions the candidate can ask the interviewers about this role and team.
Only use facts from the CV. Never invent experience, employers, tools, numbers or results. If the CV has nothing for a question, say so in the outline and leave evidence empty.`,
            prompt: `Company: ${prep.company || 'unknown'}\nRole: ${prep.role || 'unknown'}\n\nCV:\n${cvAsText(doc)}\n\nJob description:\n${prep.jobDescription}${known.length ? `\n\nSkill names already used for gaps (reuse one when it is the same skill): ${known.join(', ')}` : ''}`,
        })
        const result: InterviewPrep = {
            ...res,
            questions: res.questions.map((q) => ({ ...q, evidence: resolveEvidence(doc, q.evidence) })),
        }
        db.update(interviewPreps).set({ result, updatedAt: new Date() }).where(eq(interviewPreps.id, prep.id)).run()

        // Feed the gap tracker when this prep belongs to an application.
        if (prep.applicationId) recordGaps(prep.applicationId, res.gaps, 'ai')
        return result
    })
