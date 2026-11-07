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
            needsNumber: z.boolean().describe('True when a metric would help but none is known; never invent one'),
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

const evidenceRef = z.object({
    section: z.enum(['work', 'projects', 'education']),
    itemId: z.string().describe('The id from the CV text, e.g. the value after "id="'),
    bulletIndex: z.number().int().describe('The bullet number: 0 for b0, 1 for b1, and so on'),
})

export const interviewResultSchema = z.object({
    fitSummary: z
        .string()
        .describe(
            'Two or three sentences: where this candidate is strong for the role and what the interviewers will probe',
        ),
    questions: z
        .array(
            z.object({
                category: z.enum(['technical', 'system-design', 'behavioural', 'leadership', 'role-fit']),
                question: z.string(),
                whyTheyAsk: z.string().describe('The requirement or concern behind the question, in one sentence'),
                evidence: z
                    .array(evidenceRef)
                    .describe('CV bullets that best answer this question; empty if the CV has nothing relevant'),
                star: z
                    .object({
                        situation: z.string(),
                        task: z.string(),
                        action: z.string(),
                        result: z.string().describe('Only results stated in the CV; never invent a number'),
                    })
                    .describe('An answer outline built from the evidence bullets'),
                tip: z.string().describe('One practical delivery tip for this answer'),
            }),
        )
        .describe('10 to 12 questions, most likely first'),
    gaps: z
        .array(
            z.object({
                skill: z.string().describe('Short canonical skill name, e.g. "Terraform", "Argo CD", "RAG"'),
                requirement: z.string().describe("What the job asks for, close to the job description's wording"),
                importance: z.enum(['required', 'nice']),
                honestAnswer: z
                    .string()
                    .describe(
                        'How to answer truthfully if asked: closest real experience from the CV and how you would get up to speed',
                    ),
                howToPrepare: z
                    .string()
                    .describe('Concrete preparation before the interview, a few hours of work at most'),
            }),
        )
        .describe('Requirements of the job that the CV does not show'),
    questionsToAsk: z.array(z.string()).describe('4 to 6 sharp questions for the candidate to ask the interviewers'),
})
export type InterviewResult = z.infer<typeof interviewResultSchema>

/** Stored form: evidence references resolved to the bullet text at generation time. */
export interface InterviewPrep extends Omit<InterviewResult, 'questions'> {
    questions: (Omit<InterviewResult['questions'][number], 'evidence'> & {
        evidence: { where: string; text: string }[]
    })[]
}

export const jobImportSchema = z.object({
    isJobPosting: z.boolean().describe('False if the page is not a job posting (login wall, error page, list of jobs)'),
    company: z.string(),
    role: z.string(),
    location: z.string().describe('Empty if not stated'),
    description: z
        .string()
        .describe(
            'The full job description as plain text: about the role, responsibilities, requirements, nice-to-haves. Keep the wording and bullets ("- "). Drop navigation, cookie banners, footers and other jobs.',
        ),
})
export type JobImport = z.infer<typeof jobImportSchema>

export const gapsResultSchema = z.object({
    gaps: z.array(
        z.object({
            skill: z
                .string()
                .describe('Short canonical skill name; reuse a name from the existing list when it is the same skill'),
            requirement: z.string().describe("What the job asks for, close to the job description's wording"),
            importance: z.enum(['required', 'nice']),
        }),
    ),
})
export type GapsResult = z.infer<typeof gapsResultSchema>
