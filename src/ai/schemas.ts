import { z } from 'zod'

/**
 * Output contracts for AI tasks. Shared by server (validation) and client
 * (rendering proposals). Kept to plain types: numeric ranges are clamped in
 * code rather than expressed in the schema.
 */

export const bulletsResultSchema = z.object({
    bullets: z.array(
        z.object({
            index: z.number().describe('0-based index of the original bullet'),
            suggestion: z.string().describe('Improved bullet, or the original unchanged if already strong'),
            issues: z.array(z.string()).describe('Short problems found in the original, e.g. "no measurable result"'),
            needsNumber: z.boolean().describe('True when a metric would help but none is known — never invent one'),
        }),
    ),
})
export type BulletsResult = z.infer<typeof bulletsResultSchema>

export const summaryResultSchema = z.object({
    options: z.array(z.string()).describe('Three alternative professional summaries, 2–4 sentences each'),
})
export type SummaryResult = z.infer<typeof summaryResultSchema>

export const TAILOR_SECTIONS = ['work', 'projects', 'education'] as const

export const tailorResultSchema = z.object({
    matchScore: z.number().describe('0–100: how well the CV as written matches the job'),
    keywordsPresent: z.array(z.string()),
    keywordsMissing: z.array(z.string()).describe('Important job keywords the CV does not show'),
    summary: z
        .object({ text: z.string(), reason: z.string() })
        .nullable()
        .describe('Rewritten summary aimed at this job, or null to keep the current one'),
    bulletRewrites: z.array(
        z.object({
            section: z.enum(TAILOR_SECTIONS),
            itemId: z.string(),
            bulletIndex: z.number(),
            text: z.string(),
            reason: z.string(),
        }),
    ),
    visibility: z
        .array(
            z.object({
                section: z.enum(TAILOR_SECTIONS),
                itemId: z.string(),
                hide: z.boolean(),
                reason: z.string(),
            }),
        )
        .describe('Items to hide (irrelevant) or show again (hidden but relevant)'),
    notes: z.array(z.string()).describe('Advice that needs the candidate, e.g. a gap only they can fill'),
})
export type TailorResult = z.infer<typeof tailorResultSchema>
