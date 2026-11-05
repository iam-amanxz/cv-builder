import { createFileRoute } from '@tanstack/react-router'
import { getLetterFile } from '#/server/letters.server'

/** Renders a cover letter to PDF on demand (letters are drafts, not stored exports). */
export const Route = createFileRoute('/api/letters/$letterId/pdf')({
    server: {
        handlers: {
            GET: async ({ params }) => {
                const file = await getLetterFile(params.letterId)
                if (!file) return new Response('Not found', { status: 404 })
                return new Response(new Uint8Array(file.pdf), {
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename="${file.fileName}"`,
                        'Cache-Control': 'no-store',
                    },
                })
            },
        },
    },
})
