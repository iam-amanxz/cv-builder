import { eq } from 'drizzle-orm'
import { getDb, schema } from '#/db'
import { renderPdf } from './pdf.server'

const slug = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)

/** Server-only: render a letter to PDF with a readable file name. */
export async function getLetterFile(id: string) {
    const { coverLetters, variants } = schema
    const row = getDb()
        .select({ company: coverLetters.company, doc: variants.doc })
        .from(coverLetters)
        .innerJoin(variants, eq(variants.id, coverLetters.variantId))
        .where(eq(coverLetters.id, id))
        .get()
    if (!row) return null
    const pdf = await renderPdf(`/print/letter/${id}`)
    const who = slug(row.doc.basics.name) || 'cover'
    const to = slug(row.company)
    return { pdf, fileName: `${who}-cover-letter${to ? `-${to}` : ''}.pdf` }
}
