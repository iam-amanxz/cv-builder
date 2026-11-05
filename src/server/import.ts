import { createServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { cvDocSchema } from '#/cv/schema'
import { docFromExtracted, docFromJsonResume, extractedCvSchema, looksLikeJsonResume } from '#/cv/importers'
import { DEFAULT_THEME_ID } from '#/themes'

const MAX_BYTES = 10 * 1024 * 1024

const EXTRACT_SYSTEM = `You convert an existing CV into structured data. Copy the content faithfully: keep the owner's wording for summaries and bullets, fix only obvious extraction artefacts (broken hyphenation, stray page numbers, headers/footers). Never invent or embellish anything; leave a field empty when the CV doesn't say. Dates as YYYY-MM when month is known, otherwise YYYY; endDate empty for a current role. Put sections that don't fit the standard ones into "other".`

/**
 * Parse an uploaded CV into a CvDoc for review. JSON Resume files are mapped
 * directly; PDF, Word and text go through the AI extractor.
 */
export const parseUpload = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            fileName: z.string().max(300),
            mime: z.string().max(200),
            base64: z.string().optional(),
            text: z.string().max(200_000).optional(),
        }),
    )
    .handler(async ({ data }) => {
        const bytes = data.base64 ? Buffer.from(data.base64, 'base64') : null
        if (bytes && bytes.byteLength > MAX_BYTES) throw new Error('File is larger than 10 MB.')
        const name = data.fileName.toLowerCase()

        // 1. JSON (JSON Resume or this app's export): no AI.
        if (name.endsWith('.json') || data.mime === 'application/json') {
            let parsed: unknown
            try {
                parsed = JSON.parse((bytes ?? Buffer.from(data.text ?? '')).toString('utf8'))
            } catch {
                throw new Error('That JSON file could not be read.')
            }
            if (!looksLikeJsonResume(parsed)) throw new Error('JSON file is not in JSON Resume format.')
            return { doc: docFromJsonResume(parsed as Record<string, unknown>), via: 'json' as const }
        }

        // 2. Everything else needs the AI extractor.
        const { runStructured } = await import('#/ai/client.server')
        let prompt: Parameters<typeof runStructured>[0]['prompt']
        if (name.endsWith('.pdf') || data.mime === 'application/pdf') {
            if (!bytes) throw new Error('No file content received.')
            prompt = [
                {
                    type: 'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') },
                },
                { type: 'text', text: 'Extract this CV.' },
            ]
        } else if (name.endsWith('.docx')) {
            if (!bytes) throw new Error('No file content received.')
            const mammoth = await import('mammoth')
            const { value } = await mammoth.extractRawText({ buffer: bytes })
            if (!value.trim()) throw new Error('No text found in that Word file.')
            prompt = `Extract this CV:\n\n${value}`
        } else {
            const text = data.text ?? bytes?.toString('utf8') ?? ''
            if (text.trim().length < 50) throw new Error('Not enough text to import.')
            prompt = `Extract this CV:\n\n${text}`
        }
        const extracted = await runStructured({
            kind: 'import',
            effort: 'medium',
            output: extractedCvSchema,
            logInput: { fileName: data.fileName, mime: data.mime, bytes: bytes?.byteLength ?? data.text?.length },
            system: EXTRACT_SYSTEM,
            prompt,
        })
        return { doc: docFromExtracted(extracted), via: 'ai' as const }
    })

/** Save a reviewed import as a new CV. */
export const createFromImport = createServerFn({ method: 'POST' })
    .validator(z.object({ name: z.string().trim().min(1).max(100), doc: cvDocSchema }))
    .handler(async ({ data }) => {
        const id = nanoid(10)
        getDb()
            .insert(schema.variants)
            .values({
                id,
                name: data.name,
                doc: data.doc,
                themeId: DEFAULT_THEME_ID,
                themeOverrides: {},
                updatedAt: new Date(),
            })
            .run()
        return { id }
    })
