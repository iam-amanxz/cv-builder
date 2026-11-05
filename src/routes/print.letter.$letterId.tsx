import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getLetterForPrint } from '#/server/letters'
import { Letter, letterDate } from '#/themes/letter'

/** Bare render of a cover letter for Playwright PDF export. */
export const Route = createFileRoute('/print/letter/$letterId')({
    loader: ({ params }) => getLetterForPrint({ data: { id: params.letterId } }),
    head: () => ({ meta: [{ title: 'Print letter' }, { name: 'robots', content: 'noindex' }] }),
    component: PrintLetter,
})

function PrintLetter() {
    const { letter, doc, tokens } = Route.useLoaderData()
    const [hydrated, setHydrated] = useState(false)
    useEffect(() => setHydrated(true), [])
    return (
        <div data-cv-ready={hydrated ? '' : undefined}>
            <style>{`
        @page { size: ${tokens.pageSize}; margin: ${Math.max(tokens.marginMm, 18)}mm; }
        html, body { background: #fff !important; }
      `}</style>
            <Letter
                doc={doc}
                tokens={tokens}
                company={letter.company}
                role={letter.role}
                recipient={letter.recipient}
                body={letter.body}
                date={letterDate(letter.updatedAt)}
            />
        </div>
    )
}
