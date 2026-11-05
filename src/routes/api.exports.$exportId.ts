import fs from 'node:fs/promises'
import { createFileRoute } from '@tanstack/react-router'
import { readExport } from '#/server/files.server'

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  json: 'application/json',
  md: 'text/markdown; charset=utf-8',
} as const

export const Route = createFileRoute('/api/exports/$exportId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const found = readExport(params.exportId)
        if (!found) return new Response('Not found', { status: 404 })
        const body = await fs.readFile(found.filePath).catch(() => null)
        if (!body) return new Response('File missing on disk', { status: 410 })
        const inline = new URL(request.url).searchParams.has('inline')
        return new Response(new Uint8Array(body), {
          headers: {
            'Content-Type': CONTENT_TYPES[found.row.format],
            'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${found.row.fileName}"`,
            'Cache-Control': 'private, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})
