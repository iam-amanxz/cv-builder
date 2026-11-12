import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, CircleX, Loader2, ScanText, X } from 'lucide-react'
import { atsCheck } from '#/server/ats'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import type { AtsStatus } from '#/cv/ats'

const ICON: Record<AtsStatus, React.ReactNode> = {
    pass: <CircleCheck className="size-4 text-win-ink" />,
    warn: <CircleAlert className="size-4 text-warn-ink" />,
    fail: <CircleX className="size-4 text-bad-ink" />,
}

/** Slide-over that runs the ATS check against the current CV. */
export function AtsPanel({
    variantId,
    beforeRun,
    onClose,
}: {
    variantId: string
    beforeRun: () => Promise<void>
    onClose: () => void
}) {
    const [showText, setShowText] = useState(false)
    const run = useMutation({
        mutationFn: async () => {
            await beforeRun()
            return atsCheck({ data: { variantId } })
        },
    })
    const counts = run.data?.checks.reduce((acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }), {
        pass: 0,
        warn: 0,
        fail: 0,
    } as Record<AtsStatus, number>)

    return (
        <aside
            aria-label="ATS check"
            className="absolute inset-y-0 right-0 z-20 flex w-[420px] max-w-full flex-col border-l bg-card shadow-xl"
        >
            <div className="flex items-center gap-2 border-b px-4 py-2">
                <ScanText className="size-4" />
                <h2 className="font-medium">ATS check</h2>
                <Button variant="ghost" size="icon" className="ml-auto" aria-label="Close ATS check" onClick={onClose}>
                    <X />
                </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
                <p className="text-muted-foreground">
                    Renders your CV to PDF and reads it back the way an applicant tracking system does: text, contact
                    details, headings and reading order.
                </p>
                <Button className="w-full" disabled={run.isPending} onClick={() => run.mutate()}>
                    {run.isPending ? <Loader2 className="animate-spin" /> : <ScanText />}
                    {run.data ? 'Run again' : 'Run check'}
                </Button>
                {run.error && <p className="text-destructive">{run.error.message}</p>}
                {run.data && counts && (
                    <>
                        <p className="text-muted-foreground text-xs">
                            {counts.pass} passed · {counts.warn} warnings · {counts.fail} problems
                        </p>
                        <ul className="space-y-2">
                            {run.data.checks.map((c) => (
                                <li
                                    key={c.id}
                                    className={cn(
                                        'flex gap-2 rounded-md border p-2',
                                        c.status === 'fail' && 'border-bad bg-bad-wash/50',
                                        c.status === 'warn' && 'border-warn bg-warn-wash/50',
                                    )}
                                >
                                    <span className="mt-0.5">{ICON[c.status]}</span>
                                    <div className="min-w-0">
                                        <p className="font-medium">{c.title}</p>
                                        {c.detail && (
                                            <p className="text-muted-foreground text-xs break-words">{c.detail}</p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <Button variant="ghost" size="sm" onClick={() => setShowText((s) => !s)}>
                            {showText ? 'Hide' : 'Show'} extracted text
                        </Button>
                        {showText && (
                            <pre className="max-h-96 overflow-auto rounded bg-muted p-2 text-[11px] whitespace-pre-wrap">
                                {run.data.text}
                            </pre>
                        )}
                    </>
                )}
            </div>
        </aside>
    )
}
