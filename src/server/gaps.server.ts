import { nanoid } from 'nanoid'
import { eq, sql } from 'drizzle-orm'
import { getDb, schema } from '#/db'
import { skillKey } from '#/cv/applications'
import { cvDocSchema } from '#/cv/schema'
import { gapsResultSchema } from '#/ai/schemas'
import { cvAsText } from '#/ai/cv-text'

/**
 * Add gaps to an application. A skill already recorded for that application is
 * updated rather than duplicated (same `skillKey`).
 */
export function recordGaps(
    applicationId: string,
    gaps: { skill: string; requirement: string; importance: 'required' | 'nice' }[],
    source: 'ai' | 'manual',
) {
    const db = getDb()
    for (const g of gaps) {
        const skill = g.skill.trim()
        const key = skillKey(skill)
        if (!key) continue
        db.insert(schema.jobGaps)
            .values({
                id: nanoid(10),
                applicationId,
                skill,
                skillKey: key,
                importance: g.importance,
                requirement: g.requirement.trim(),
                source,
            })
            .onConflictDoUpdate({
                target: [schema.jobGaps.applicationId, schema.jobGaps.skillKey],
                set: {
                    requirement: sql`coalesce(nullif(excluded.requirement, ''), ${schema.jobGaps.requirement})`,
                    // Never downgrade: required by any source stays required.
                    importance: sql`case when excluded.importance = 'required' or ${schema.jobGaps.importance} = 'required' then 'required' else 'nice' end`,
                },
            })
            .run()
    }
}

/** Skill names already tracked, so the AI can reuse them instead of inventing variants. */
export function knownSkills(): string[] {
    return getDb()
        .selectDistinct({ skill: schema.jobGaps.skill })
        .from(schema.jobGaps)
        .all()
        .map((r) => r.skill)
}

/**
 * AI gap analysis for one application: the job description against the CV
 * linked to it (or the master CV). Results are merged into the gap tracker.
 */
export async function analyseApplicationGaps(applicationId: string): Promise<number> {
    const db = getDb()
    const { applications, variants } = schema
    const app = db.select().from(applications).where(eq(applications.id, applicationId)).get()
    if (!app) throw new Error('Application not found')
    if (app.jobDescription.trim().length < 40) throw new Error('Add the job description to this application first')
    const variant =
        (app.variantId && db.select().from(variants).where(eq(variants.id, app.variantId)).get()) ||
        db.select().from(variants).where(eq(variants.isMaster, true)).get()
    if (!variant) throw new Error('No CV to compare against')

    const { runStructured } = await import('#/ai/client.server')
    const known = knownSkills()
    const res = await runStructured({
        kind: 'gaps',
        variantId: variant.id,
        effort: 'medium',
        output: gapsResultSchema,
        logInput: { applicationId },
        system: `You compare a job description with a candidate's CV and list the skills, tools, technologies, practices and certifications the job asks for that the CV does not show.
- One skill per entry, with a short canonical name ("Terraform", "Argo CD", "Prometheus", "RAG", "AZ-104"). Split combined requirements into separate skills.
- Only list real gaps. If the CV shows the skill, even under a different name, leave it out.
- Mark each as required or nice to have, based on how the job description words it.
- Reuse a name from the existing list when it is the same skill, so gaps from different jobs can be counted together.`,
        prompt: `CV:\n${cvAsText(cvDocSchema.parse(variant.doc))}\n\nJob description:\n${app.jobDescription}${known.length ? `\n\nExisting skill names: ${known.join(', ')}` : ''}`,
    })
    recordGaps(applicationId, res.gaps, 'ai')
    return res.gaps.length
}
