import { createFileRoute } from '@tanstack/react-router'
import { createBackup, restoreBackup } from '#/server/backup.server'

const MAX_BYTES = 500 * 1024 * 1024

export const Route = createFileRoute('/api/backup')({
    server: {
        handlers: {
            GET: async () => {
                const { zip, fileName } = await createBackup()
                return new Response(new Uint8Array(zip), {
                    headers: {
                        'Content-Type': 'application/zip',
                        'Content-Disposition': `attachment; filename="${fileName}"`,
                        'Cache-Control': 'no-store',
                    },
                })
            },
            POST: async ({ request }) => {
                const len = Number(request.headers.get('content-length') ?? 0)
                if (len > MAX_BYTES) return Response.json({ error: 'Backup is too large.' }, { status: 413 })
                try {
                    const result = restoreBackup(new Uint8Array(await request.arrayBuffer()))
                    return Response.json(result)
                } catch (err) {
                    return Response.json(
                        { error: err instanceof Error ? err.message : 'Restore failed' },
                        { status: 400 },
                    )
                }
            },
        },
    },
})
