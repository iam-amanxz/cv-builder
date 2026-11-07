import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { SKILL_STATUSES, skillKey } from '#/cv/applications'
import type { SkillStatus } from '#/cv/applications'

const { jobGaps, applications, skillProgress } = schema

export interface SkillGap {
    key: string
    skill: string
    status: SkillStatus
    notes: string
    required: number
    nice: number
    jobs: {
        gapId: string
        applicationId: string
        company: string
        role: string
        appStatus: string
        importance: 'required' | 'nice'
        requirement: string
    }[]
}

/** Every gap across all applications, grouped by skill, most-demanded first. */
export const listGaps = createServerFn({ method: 'GET' }).handler(async (): Promise<SkillGap[]> => {
    const db = getDb()
    const rows = db
        .select({
            gap: jobGaps,
            company: applications.company,
            role: applications.role,
            appStatus: applications.status,
        })
        .from(jobGaps)
        .innerJoin(applications, eq(applications.id, jobGaps.applicationId))
        .all()
    const progress = new Map(
        db
            .select()
            .from(skillProgress)
            .all()
            .map((p) => [p.skillKey, p]),
    )
    const bySkill = new Map<string, SkillGap>()
    for (const r of rows) {
        const key = r.gap.skillKey
        let g = bySkill.get(key)
        if (!g) {
            const p = progress.get(key)
            g = {
                key,
                skill: r.gap.skill,
                status: p?.status ?? 'open',
                notes: p?.notes ?? '',
                required: 0,
                nice: 0,
                jobs: [],
            }
            bySkill.set(key, g)
        }
        // Show the best-written spelling: "Terraform" over "terraform".
        if (g.skill === g.skill.toLowerCase() && r.gap.skill !== r.gap.skill.toLowerCase()) g.skill = r.gap.skill
        g[r.gap.importance] += 1
        g.jobs.push({
            gapId: r.gap.id,
            applicationId: r.gap.applicationId,
            company: r.company,
            role: r.role,
            appStatus: r.appStatus,
            importance: r.gap.importance,
            requirement: r.gap.requirement,
        })
    }
    const rank: Record<SkillStatus, number> = { learning: 0, open: 1, have: 2, ignore: 3 }
    return [...bySkill.values()].sort(
        (a, b) =>
            rank[a.status] - rank[b.status] ||
            b.required * 2 + b.nice - (a.required * 2 + a.nice) ||
            a.skill.localeCompare(b.skill),
    )
})

/** Gaps recorded for one application (for the application panel). */
export const listApplicationGaps = createServerFn({ method: 'GET' })
    .validator(z.object({ applicationId: z.string() }))
    .handler(async ({ data }) =>
        getDb().select().from(jobGaps).where(eq(jobGaps.applicationId, data.applicationId)).all(),
    )

export const setSkillStatus = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            key: z.string().min(1),
            status: z.enum(SKILL_STATUSES).optional(),
            notes: z.string().max(5000).optional(),
        }),
    )
    .handler(async ({ data }) => {
        const { key, ...patch } = data
        getDb()
            .insert(skillProgress)
            .values({ skillKey: key, status: patch.status ?? 'open', notes: patch.notes ?? '', updatedAt: new Date() })
            .onConflictDoUpdate({ target: skillProgress.skillKey, set: { ...patch, updatedAt: new Date() } })
            .run()
        return { ok: true }
    })

export const addGap = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            applicationId: z.string(),
            skill: z.string().trim().min(1).max(100),
            importance: z.enum(['required', 'nice']),
            requirement: z.string().max(1000),
        }),
    )
    .handler(async ({ data }) => {
        if (!skillKey(data.skill)) throw new Error('Enter a skill name')
        const { recordGaps } = await import('./gaps.server')
        recordGaps(data.applicationId, [data], 'manual')
        return { ok: true }
    })

export const removeGap = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        getDb().delete(jobGaps).where(eq(jobGaps.id, data.id)).run()
        return { ok: true }
    })

export const analyseGaps = createServerFn({ method: 'POST' })
    .validator(z.object({ applicationId: z.string() }))
    .handler(async ({ data }) => {
        const { analyseApplicationGaps } = await import('./gaps.server')
        return { found: await analyseApplicationGaps(data.applicationId) }
    })
