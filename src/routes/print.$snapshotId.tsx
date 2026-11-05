import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getSnapshot } from '#/server/export'
import { getTheme } from '#/themes'

/**
 * Bare render of a frozen snapshot, used by Playwright for PDF export.
 * Page size and margins come from @page so multi-page output has
 * correct margins on every page.
 */
export const Route = createFileRoute('/print/$snapshotId')({
    loader: ({ params }) => getSnapshot({ data: { id: params.snapshotId } }),
    head: () => ({ meta: [{ title: 'Print' }, { name: 'robots', content: 'noindex' }] }),
    component: PrintPage,
})

function PrintPage() {
    const snap = Route.useLoaderData()
    const theme = getTheme(snap.themeId)
    const t = snap.themeTokens
    const [hydrated, setHydrated] = useState(false)
    useEffect(() => setHydrated(true), [])

    return (
        <div data-cv-ready={hydrated ? '' : undefined}>
            <style>{`
        @page { size: ${t.pageSize}; margin: ${t.marginMm}mm; }
        html, body { background: #fff !important; }
        @media screen { body > div { max-width: 900px; margin: 24px auto; } }
      `}</style>
            <theme.Component doc={snap.doc} tokens={t} />
        </div>
    )
}
