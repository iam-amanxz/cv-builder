import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
import { improveBullets, suggestSummary } from '#/ai/tasks'
import { Button } from '#/components/ui/button'
import { useAiEditor } from './ai-context'
import type { BulletsResult } from '#/ai/schemas'
import type { CvDoc } from '#/cv/schema'

function AiButton({
    onClick,
    pending,
    children,
}: {
    onClick: () => void
    pending: boolean
    children: React.ReactNode
}) {
    const ai = useAiEditor()
    if (!ai) return null
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-violet-700 hover:text-violet-800"
            disabled={!ai.enabled || pending}
            title={ai.enabled ? undefined : 'Set ANTHROPIC_API_KEY in .env to enable AI'}
            onClick={onClick}
        >
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {children}
        </Button>
    )
}

function ErrorLine({ error }: { error: Error | null }) {
    return error ? <p className="text-destructive text-xs">{error.message}</p> : null
}

/** Suggests improved versions of an item's bullets; each can be accepted on its own. */
export function BulletCoach({
    role,
    organisation,
    highlights,
    onApply,
}: {
    role: string
    organisation: string
    highlights: string[]
    onApply: (next: string[]) => void
}) {
    const ai = useAiEditor()
    const [result, setResult] = useState<{ source: string[]; data: BulletsResult } | null>(null)
    const [done, setDone] = useState<Set<number>>(new Set())
    const bullets = highlights.map((h) => h.trim()).filter(Boolean)

    const run = useMutation({
        mutationFn: () => improveBullets({ data: { variantId: ai?.variantId ?? '', role, organisation, bullets } }),
        onSuccess: (data) => {
            setResult({ source: bullets, data })
            setDone(new Set())
        },
    })

    const accept = async (indexes: number[]) => {
        if (!result || !ai) return
        await ai.beforeApply(`Before AI bullets: ${role || organisation}`.slice(0, 120))
        // Map back onto the current (possibly blank-line-containing) highlights array.
        const next = [...highlights]
        const positions = highlights.flatMap((h, i) => (h.trim() ? [i] : []))
        for (const i of indexes) {
            const s = result.data.bullets.find((b) => b.index === i)
            const pos = positions[i] as number | undefined
            if (s && pos !== undefined && next[pos].trim() === result.source[i]) next[pos] = s.suggestion
        }
        onApply(next)
        setDone((d) => new Set([...d, ...indexes]))
    }

    if (!bullets.length) return null
    const open = result?.data.bullets.filter((b) => b.suggestion.trim() !== result.source[b.index]?.trim()) ?? []

    return (
        <div className="col-span-2 space-y-2">
            {!result && (
                <AiButton onClick={() => run.mutate()} pending={run.isPending}>
                    Improve bullets
                </AiButton>
            )}
            <ErrorLine error={run.error} />
            {result && (
                <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/50 p-2">
                    <div className="flex items-center gap-2 text-xs">
                        <Sparkles className="size-3.5 text-violet-700" />
                        <span className="font-medium">Suggestions</span>
                        <span className="text-muted-foreground">
                            {open.length ? '' : 'Bullets already look strong.'}
                        </span>
                        <div className="ml-auto flex gap-1">
                            {open.some((b) => !done.has(b.index)) && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7"
                                    onClick={() =>
                                        void accept(open.filter((b) => !done.has(b.index)).map((b) => b.index))
                                    }
                                >
                                    <Check /> Accept all
                                </Button>
                            )}
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7"
                                onClick={() => setResult(null)}
                            >
                                <X /> Close
                            </Button>
                        </div>
                    </div>
                    {result.data.bullets.map((b) => {
                        const original = result.source[b.index] ?? ''
                        const same = b.suggestion.trim() === original.trim()
                        return (
                            <div key={b.index} className="space-y-1 rounded bg-background p-2 text-sm">
                                <div className="text-muted-foreground line-through decoration-rose-300">{original}</div>
                                {!same && <div className="text-emerald-900">{b.suggestion}</div>}
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {b.issues.map((i) => (
                                        <span
                                            key={i}
                                            className="rounded bg-amber-100 px-1.5 text-[11px] text-amber-800"
                                        >
                                            {i}
                                        </span>
                                    ))}
                                    {b.needsNumber && (
                                        <span className="rounded bg-sky-100 px-1.5 text-[11px] text-sky-800">
                                            add a number if you have one
                                        </span>
                                    )}
                                    {!same &&
                                        (done.has(b.index) ? (
                                            <span className="ml-auto text-xs text-emerald-700">Applied</span>
                                        ) : (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="ml-auto h-6 px-2 text-xs"
                                                onClick={() => void accept([b.index])}
                                            >
                                                Accept
                                            </Button>
                                        ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/** Offers three summary options generated from the CV. */
export function SummaryHelper({ doc, onApply }: { doc: CvDoc; onApply: (text: string) => void }) {
    const ai = useAiEditor()
    const [options, setOptions] = useState<string[] | null>(null)
    const run = useMutation({
        mutationFn: () => suggestSummary({ data: { variantId: ai?.variantId ?? '', doc } }),
        onSuccess: (d) => setOptions(d.options),
    })
    return (
        <div className="col-span-2 space-y-2">
            <AiButton onClick={() => run.mutate()} pending={run.isPending}>
                {options ? 'Suggest again' : 'Suggest summary'}
            </AiButton>
            <ErrorLine error={run.error} />
            {options?.map((o, i) => (
                <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50/50 p-2 text-sm"
                >
                    <p className="flex-1">{o}</p>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={async () => {
                            await ai?.beforeApply('Before AI summary')
                            onApply(o)
                            setOptions(null)
                        }}
                    >
                        Use
                    </Button>
                </div>
            ))}
        </div>
    )
}
