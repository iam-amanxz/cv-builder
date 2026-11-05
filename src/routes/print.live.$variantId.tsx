import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getVariant } from '#/server/variants'
import { getTheme, resolveTokens } from '#/themes'

/**
 * Bare render of a CV's current working copy (not a frozen snapshot).
 * Used for checks such as the ATS test, which must not create versions.
 */
export const Route = createFileRoute('/print/live/$variantId')({
    loader: ({ params }) => getVariant({ data: { id: params.variantId } }),
    head: () => ({ meta: [{ title: 'Print' }, { name: 'robots', content: 'noindex' }] }),
    component: PrintLive,
})

function PrintLive() {
    const v = Route.useLoaderData()
    const theme = getTheme(v.themeId)
    const t = resolveTokens(v.themeId, v.themeOverrides)
    const [hydrated, setHydrated] = useState(false)
    useEffect(() => setHydrated(true), [])
    return (
        <div data-cv-ready={hydrated ? '' : undefined}>
            <style>{`
        @page { size: ${t.pageSize}; margin: ${t.marginMm}mm; }
        html, body { background: #fff !important; }
      `}</style>
            <theme.Component doc={v.doc} tokens={t} />
        </div>
    )
}
