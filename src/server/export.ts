import fs from 'node:fs/promises'
import path from 'node:path'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { EXPORTS_DIR, getDb, schema } from '#/db'
import { createSnapshot } from './snapshots.server'
import { cvDocSchema } from '#/cv/schema'
import { renderMarkdown } from '#/export/markdown'
import { toJsonResume } from '#/export/jsonresume'
import type { CvDoc } from '#/cv/schema'
import type { ThemeTokens } from '#/themes/types'

const { snapshots, exportsTable } = schema

function slug(s: string) {
    return (
        s
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 40) || 'cv'
    )
}

export const getSnapshot = createServerFn({ method: 'GET' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        const row = getDb().select().from(snapshots).where(eq(snapshots.id, data.id)).get()
        if (!row) throw new Error('Snapshot not found')
        return row
    })

const FORMATS = ['pdf', 'docx', 'md', 'json'] as const
export type ExportFormat = (typeof FORMATS)[number]

async function render(format: ExportFormat, snapshotId: string, doc: CvDoc, tokens: ThemeTokens): Promise<Buffer> {
    switch (format) {
        case 'pdf': {
            const { renderPdf } = await import('./pdf.server')
            return renderPdf(`/print/${snapshotId}`)
        }
        case 'docx': {
            const { renderDocx } = await import('#/export/docx.server')
            return renderDocx(doc, tokens)
        }
        case 'md':
            return Buffer.from(renderMarkdown(doc), 'utf8')
        case 'json':
            return Buffer.from(JSON.stringify(toJsonResume(doc, new Date()), null, 2) + '\n', 'utf8')
    }
}

/** Snapshot the CV, render it in the requested format, keep the file. */
export const exportFile = createServerFn({ method: 'POST' })
    .validator(z.object({ variantId: z.string(), format: z.enum(FORMATS) }))
    .handler(async ({ data }) => {
        const { id: snapshotId, variant, tokens } = createSnapshot(data.variantId, 'export')
        const doc = cvDocSchema.parse(variant.doc)
        const body = await render(data.format, snapshotId, doc, tokens)

        const name = doc.basics.name || variant.name
        const date = new Date().toISOString().slice(0, 10)
        const fileName = `${slug(name)}-${slug(variant.name)}-${date}-${snapshotId.slice(0, 6)}.${data.format}`
        await fs.writeFile(path.join(EXPORTS_DIR, fileName), body)

        const id = nanoid(12)
        getDb()
            .insert(exportsTable)
            .values({ id, snapshotId, format: data.format, fileName, bytes: body.byteLength })
            .run()
        return { id, fileName }
    })
