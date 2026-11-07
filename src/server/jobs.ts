import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { jobImportSchema } from '#/ai/schemas'

export interface FetchedJob {
    url: string
    company: string
    role: string
    location: string
    description: string
    /** How the details were read: the site's structured data, the AI, or raw page text. */
    source: 'structured' | 'ai' | 'page'
}

const httpUrl = z
    .string()
    .trim()
    .url('Enter a full link, starting with https://')
    .refine((u) => /^https?:\/\//i.test(u), 'Only http and https links are supported')

/** Open a job posting link and read its company, role, location and description. */
export const fetchJob = createServerFn({ method: 'POST' })
    .validator(z.object({ url: httpUrl }))
    .handler(async ({ data }): Promise<FetchedJob> => {
        const { loadExternalPage } = await import('./pdf.server')
        const page = await loadExternalPage(data.url)
        const host = new URL(page.url).hostname.replace(/^www\./, '')
        // og:site_name is sometimes a slogan ("Boost your digital potential"); then use the domain ("99x").
        const brand =
            page.siteName && page.siteName.split(/\s+/).length <= 3 ? page.siteName : (host.split('.').at(-2) ?? host)

        // Most job boards embed a schema.org JobPosting: exact, and free.
        const jp = page.jobPosting
        if (jp && jp.title && jp.description.length > 200) {
            return {
                url: data.url,
                company: jp.company || brand,
                role: jp.title,
                location: jp.location,
                description: jp.description,
                source: 'structured',
            }
        }

        const { aiConfigured, runStructured } = await import('#/ai/client.server')
        if (aiConfigured()) {
            const res = await runStructured({
                kind: 'job-import',
                effort: 'low',
                output: jobImportSchema,
                logInput: { url: data.url },
                system: `You read the text of a web page and extract the job posting on it. Copy the job description faithfully: keep the employer's wording and bullet points; drop navigation, cookie notices, footers and links to other jobs. Never add anything that is not on the page.`,
                prompt: `URL: ${page.url}\nPage title: ${page.title}\nSite: ${page.siteName || host}\n\nPage text:\n${page.text.slice(0, 30_000)}`,
            })
            if (!res.isJobPosting)
                throw new Error(
                    "That page doesn't look like a job posting. It may need a login; paste the description instead.",
                )
            return { url: data.url, ...res, source: 'ai' }
        }

        if (page.text.length < 200)
            throw new Error("Couldn't read a job description from that page. Paste the description instead.")
        return {
            url: data.url,
            company: brand,
            role: page.title,
            location: '',
            description: page.text,
            source: 'page',
        }
    })

/**
 * Create an application from a job, optionally with its own copy of a CV to
 * tailor, and optionally run the AI gap analysis straight away.
 */
export const createFromJob = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            url: z.string().max(1000),
            company: z.string().trim().min(1, 'Company is required').max(200),
            role: z.string().max(200),
            location: z.string().max(200),
            jobDescription: z.string().max(40000),
            baseVariantId: z.string().nullable(),
            copyCv: z.boolean(),
            findGaps: z.boolean(),
        }),
    )
    .handler(async ({ data }) => {
        const db = getDb()
        const { variants, applications } = schema
        const now = new Date()
        let variantId = data.baseVariantId
        if (data.baseVariantId && data.copyCv) {
            const base = db.select().from(variants).where(eq(variants.id, data.baseVariantId)).get()
            if (!base) throw new Error('CV not found')
            variantId = nanoid(10)
            db.insert(variants)
                .values({
                    id: variantId,
                    name: [data.company, data.role].filter(Boolean).join(': ').slice(0, 100),
                    parentId: base.id,
                    doc: base.doc,
                    themeId: base.themeId,
                    themeOverrides: base.themeOverrides,
                    updatedAt: now,
                })
                .run()
        }
        const applicationId = nanoid(10)
        db.insert(applications)
            .values({
                id: applicationId,
                company: data.company,
                role: data.role,
                url: data.url,
                jobDescription: data.jobDescription,
                notes: data.location ? `Location: ${data.location}` : '',
                variantId,
                status: 'draft',
                updatedAt: now,
            })
            .run()

        let gapsFound: number | null = null
        let gapsError: string | null = null
        if (data.findGaps) {
            try {
                const { analyseApplicationGaps } = await import('./gaps.server')
                gapsFound = await analyseApplicationGaps(applicationId)
            } catch (err) {
                // The application is created either way; report the gap step separately.
                gapsError = err instanceof Error ? err.message : String(err)
            }
        }
        return { applicationId, variantId, copied: data.copyCv && !!data.baseVariantId, gapsFound, gapsError }
    })

/** One application, for pages that start from it (tailor, interview prep). */
export const getApplication = createServerFn({ method: 'GET' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        const app = getDb().select().from(schema.applications).where(eq(schema.applications.id, data.id)).get()
        if (!app) throw new Error('Application not found')
        return app
    })
