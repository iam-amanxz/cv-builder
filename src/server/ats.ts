import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { cvDocSchema } from '#/cv/schema'
import { runAtsChecks } from '#/cv/ats'

/**
 * Render the CV's current state to PDF (no snapshot), extract its text the way
 * an ATS would, and run the checks. Returns the extracted text for inspection.
 */
export const atsCheck = createServerFn({ method: 'POST' })
    .validator(z.object({ variantId: z.string() }))
    .handler(async ({ data }) => {
        const v = getDb().select().from(schema.variants).where(eq(schema.variants.id, data.variantId)).get()
        if (!v) throw new Error('CV not found')
        const { renderPdf } = await import('./pdf.server')
        const { extractText, getDocumentProxy } = await import('unpdf')
        const pdf = await renderPdf(`/print/live/${data.variantId}`)
        const proxy = await getDocumentProxy(new Uint8Array(pdf))
        const { text } = await extractText(proxy, { mergePages: false })
        const pages = Array.isArray(text) ? text : [text]
        return {
            checks: runAtsChecks(cvDocSchema.parse(v.doc), pages, v.themeId),
            text: pages.join('\n\n--- page break ---\n\n'),
        }
    })
