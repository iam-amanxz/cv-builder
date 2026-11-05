import fs from 'node:fs/promises'
import path from 'node:path'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { EXPORTS_DIR, getDb, schema } from '#/db'
import { createSnapshot } from './snapshots.server'

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

export const exportPdf = createServerFn({ method: 'POST' })
    .validator(z.object({ variantId: z.string() }))
    .handler(async ({ data }) => {
        const { id: snapshotId, variant } = createSnapshot(data.variantId, 'export')
        const { renderPdf } = await import('./pdf.server')
        const pdf = await renderPdf(snapshotId)

        const name = variant.doc.basics.name || variant.name
        const date = new Date().toISOString().slice(0, 10)
        const fileName = `${slug(name)}-${slug(variant.name)}-${date}-${snapshotId.slice(0, 6)}.pdf`
        await fs.writeFile(path.join(EXPORTS_DIR, fileName), pdf)

        const id = nanoid(12)
        getDb().insert(exportsTable).values({ id, snapshotId, format: 'pdf', fileName, bytes: pdf.byteLength }).run()
        return { id, fileName }
    })
