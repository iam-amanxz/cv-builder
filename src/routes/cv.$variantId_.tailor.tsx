import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { ArrowLeft, Copy, Eye, EyeOff, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { aiStatusQuery, variantQuery } from '#/cv/queries'
import { applyAiDoc, tailorToJob } from '#/ai/tasks'
import { getApplication } from '#/server/jobs'
import { allProposalKeys, applyTailor, itemLabel, originalBullet, proposalKey } from '#/ai/apply'
import { resolveTokens } from '#/themes'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { Preview } from '#/components/editor/preview'
import { cn } from '#/lib/utils'
import type { TailorResult } from '#/ai/schemas'

export const Route = createFileRoute('/cv/$variantId_/tailor')({
    /** `app`: start from this application's job description. */
    validateSearch: z.object({ app: z.string().optional() }),
    loader: ({ context, params }) => context.queryClient.ensureQueryData(variantQuery(params.variantId)),
    head: ({ loaderData }) => ({ meta: [{ title: `Tailor · ${loaderData?.name ?? 'CV'} · CV Builder` }] }),
    component: TailorPage,
})

function Check({
    checked,
    onChange,
    children,
}: {
    checked: boolean
    onChange: (v: boolean) => void
    children: React.ReactNode
}) {
    return (
        <label
            className={cn(
                'flex cursor-pointer gap-3 rounded-md border bg-card p-3 text-sm transition-colors',
                checked ? 'border-violet-300 bg-violet-50/40' : 'opacity-70',
            )}
        >
            <input
                type="checkbox"
                className="mt-0.5 size-4 accent-violet-600"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <div className="min-w-0 flex-1 space-y-1">{children}</div>
        </label>
    )
}

function Score({ value }: { value: number }) {
    const tone = value >= 75 ? 'text-emerald-700' : value >= 50 ? 'text-amber-700' : 'text-rose-700'
    return (
        <div className="flex items-baseline gap-1">
            <span className={cn('text-3xl font-semibold tabular-nums', tone)}>{value}</span>
            <span className="text-muted-foreground text-sm">/ 100 match</span>
        </div>
    )
}

function TailorPage() {
    const { variantId } = Route.useParams()
    const { data: variant } = useSuspenseQuery(variantQuery(variantId))
    const status = useQuery(aiStatusQuery())
    const qc = useQueryClient()
    const navigate = useNavigate()

    const [jd, setJd] = useState('')
    const { app: applicationId } = Route.useSearch()
    const application = useQuery({
        queryKey: ['application', applicationId],
        queryFn: () => getApplication({ data: { id: applicationId ?? '' } }),
        enabled: !!applicationId,
    })
    const fromApp = application.data?.jobDescription
    useEffect(() => {
        if (fromApp) setJd((cur) => cur || fromApp)
    }, [fromApp])
    const [result, setResult] = useState<TailorResult | null>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    const analyse = useMutation({
        mutationFn: () => tailorToJob({ data: { variantId, doc: variant.doc, jobDescription: jd } }),
        onSuccess: (r) => {
            setResult(r)
            setSelected(new Set(allProposalKeys(r)))
        },
    })

    const tailored = useMemo(
        () => (result ? applyTailor(variant.doc, result, selected) : variant.doc),
        [variant.doc, result, selected],
    )
    const tokens = resolveTokens(variant.themeId, variant.themeOverrides)

    const apply = useMutation({
        mutationFn: (mode: 'current' | 'new') => {
            const name = mode === 'new' ? prompt('Name for the tailored CV', `${variant.name} (tailored)`) : undefined
            if (mode === 'new' && !name?.trim()) throw new Error('cancelled')
            const firstLine = jd.trim().split('\n')[0]?.slice(0, 60) ?? ''
            return applyAiDoc({
                data: { variantId, doc: tailored, mode, name: name?.trim(), label: `Before tailoring: ${firstLine}` },
            })
        },
        onSuccess: async ({ id }) => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['variant', id] }),
                qc.invalidateQueries({ queryKey: ['variants'] }),
                qc.invalidateQueries({ queryKey: ['snapshots', variantId] }),
            ])
            navigate({ to: '/cv/$variantId', params: { variantId: id } })
        },
    })

    const toggle = (key: string, on: boolean) =>
        setSelected((s) => {
            const n = new Set(s)
            if (on) n.add(key)
            else n.delete(key)
            return n
        })

    const total = result ? allProposalKeys(result).length : 0
    const configured = status.data?.configured ?? false
    const applyError = apply.error && apply.error.message !== 'cancelled' ? apply.error : null

    return (
        <div className="flex h-dvh flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
                <Button asChild variant="ghost" size="icon" aria-label="Back to editor">
                    <Link to="/cv/$variantId" params={{ variantId }}>
                        <ArrowLeft />
                    </Link>
                </Button>
                <Sparkles className="size-4 text-violet-700" />
                <h1 className="font-medium">Tailor to job · {variant.name}</h1>
                {status.data && <span className="text-muted-foreground text-xs">{status.data.model}</span>}
                {result && (
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">
                            {selected.size} of {total} changes selected
                        </span>
                        <Button
                            variant="outline"
                            disabled={apply.isPending || selected.size === 0}
                            onClick={() => apply.mutate('new')}
                        >
                            <Copy /> Save as new CV
                        </Button>
                        <Button
                            disabled={apply.isPending || selected.size === 0}
                            onClick={() => apply.mutate('current')}
                        >
                            {apply.isPending ? <Loader2 className="animate-spin" /> : <Wand2 />} Apply to this CV
                        </Button>
                    </div>
                )}
            </header>
            {applyError && (
                <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm">{applyError.message}</div>
            )}

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(420px,600px)_1fr]">
                <aside className="min-h-0 space-y-4 overflow-y-auto border-r p-4">
                    {!configured && status.isSuccess && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            AI is not set up. Add <code>ANTHROPIC_API_KEY</code> to <code>.env</code> and restart the
                            container.
                        </div>
                    )}
                    <div className="space-y-2">
                        <label htmlFor="jd" className="text-sm font-medium">
                            Job description
                        </label>
                        <Textarea
                            id="jd"
                            rows={result ? 5 : 14}
                            placeholder="Paste the full job ad here…"
                            value={jd}
                            onChange={(e) => setJd(e.target.value)}
                        />
                        <Button
                            className="w-full"
                            disabled={!configured || analyse.isPending || jd.trim().length < 40}
                            onClick={() => analyse.mutate()}
                        >
                            {analyse.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                            {analyse.isPending
                                ? 'Analysing… (can take a minute)'
                                : result
                                  ? 'Analyse again'
                                  : 'Analyse'}
                        </Button>
                        {analyse.error && <p className="text-destructive text-sm">{analyse.error.message}</p>}
                        <p className="text-muted-foreground text-xs">
                            Suggestions only rephrase, reorder or hide what is already in your CV. Nothing is changed
                            until you apply, and the current version is saved first.
                        </p>
                    </div>

                    {result && (
                        <Proposals result={result} selected={selected} toggle={toggle} variantDoc={variant.doc} />
                    )}
                </aside>
                <section className="min-h-0 overflow-y-auto bg-muted/60 px-4">
                    <Preview doc={tailored} themeId={variant.themeId} tokens={tokens} />
                </section>
            </div>
        </div>
    )
}

function Proposals({
    result,
    selected,
    toggle,
    variantDoc,
}: {
    result: TailorResult
    selected: Set<string>
    toggle: (key: string, on: boolean) => void
    variantDoc: Parameters<typeof itemLabel>[0]
}) {
    return (
        <div className="space-y-5">
            <div className="space-y-3 rounded-md border bg-card p-3">
                <Score value={result.matchScore} />
                {result.keywordsMissing.length > 0 && (
                    <div>
                        <div className="text-muted-foreground mb-1 text-xs">
                            Missing keywords (add only if they are true for you)
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {result.keywordsMissing.map((k) => (
                                <span key={k} className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-800">
                                    {k}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                {result.keywordsPresent.length > 0 && (
                    <div>
                        <div className="text-muted-foreground mb-1 text-xs">Already covered</div>
                        <div className="flex flex-wrap gap-1">
                            {result.keywordsPresent.map((k) => (
                                <span key={k} className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800">
                                    {k}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                {result.notes.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                        {result.notes.map((n) => (
                            <li key={n}>{n}</li>
                        ))}
                    </ul>
                )}
            </div>

            {result.summary && (
                <section className="space-y-2">
                    <h2 className="text-sm font-semibold">Summary</h2>
                    <Check
                        checked={selected.has(proposalKey.summary())}
                        onChange={(v) => toggle(proposalKey.summary(), v)}
                    >
                        <p className="text-muted-foreground line-through decoration-rose-300">
                            {variantDoc.basics.summary || '(empty)'}
                        </p>
                        <p className="text-emerald-900">{result.summary.text}</p>
                        <p className="text-muted-foreground text-xs">{result.summary.reason}</p>
                    </Check>
                </section>
            )}

            {result.bulletRewrites.length > 0 && (
                <section className="space-y-2">
                    <h2 className="text-sm font-semibold">Bullet rewrites</h2>
                    {result.bulletRewrites.map((b) => {
                        const key = proposalKey.bullet(b.section, b.itemId, b.bulletIndex)
                        return (
                            <Check key={key} checked={selected.has(key)} onChange={(v) => toggle(key, v)}>
                                <p className="text-muted-foreground text-xs">
                                    {itemLabel(variantDoc, b.section, b.itemId)}
                                </p>
                                <p className="text-muted-foreground line-through decoration-rose-300">
                                    {originalBullet(variantDoc, b.section, b.itemId, b.bulletIndex)}
                                </p>
                                <p className="text-emerald-900">{b.text}</p>
                                <p className="text-muted-foreground text-xs">{b.reason}</p>
                            </Check>
                        )
                    })}
                </section>
            )}

            {result.visibility.length > 0 && (
                <section className="space-y-2">
                    <h2 className="text-sm font-semibold">Show / hide</h2>
                    {result.visibility.map((v) => {
                        const key = proposalKey.visibility(v.section, v.itemId)
                        return (
                            <Check key={key} checked={selected.has(key)} onChange={(on) => toggle(key, on)}>
                                <p className="flex items-center gap-1.5 font-medium">
                                    {v.hide ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    {v.hide ? 'Hide' : 'Show'} {itemLabel(variantDoc, v.section, v.itemId)}
                                </p>
                                <p className="text-muted-foreground text-xs">{v.reason}</p>
                            </Check>
                        )
                    })}
                </section>
            )}

            {!result.summary && !result.bulletRewrites.length && !result.visibility.length && (
                <p className="text-muted-foreground text-sm">No edits suggested. This CV already fits the job well.</p>
            )}
        </div>
    )
}
