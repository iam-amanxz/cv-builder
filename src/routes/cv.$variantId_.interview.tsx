import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import {
    ArrowLeft,
    ClipboardCopy,
    Lightbulb,
    Loader2,
    MessagesSquare,
    Plus,
    Sparkles,
    Target,
    Trash2,
} from 'lucide-react'
import { aiStatusQuery, prepsQuery, variantQuery } from '#/cv/queries'
import { createPrep, deletePrep, generatePrep, updatePrep } from '#/server/interview'
import { QUESTION_CATEGORIES, prepToMarkdown } from '#/cv/interview'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'
import type { InterviewPrep } from '#/ai/schemas'

export const Route = createFileRoute('/cv/$variantId_/interview')({
    validateSearch: z.object({ id: z.string().optional() }),
    loader: async ({ context, params }) => {
        const [variant] = await Promise.all([
            context.queryClient.ensureQueryData(variantQuery(params.variantId)),
            context.queryClient.ensureQueryData(prepsQuery(params.variantId)),
        ])
        return variant
    },
    head: ({ loaderData }) => ({ meta: [{ title: `Interview prep · ${loaderData?.name ?? 'CV'} · CV Builder` }] }),
    component: InterviewPage,
})

type Draft = { company: string; role: string; jobDescription: string; notes: string }
const EMPTY: Draft = { company: '', role: '', jobDescription: '', notes: '' }
type Category = keyof typeof QUESTION_CATEGORIES

function InterviewPage() {
    const { variantId } = Route.useParams()
    const { id: selectedId } = Route.useSearch()
    const navigate = useNavigate({ from: Route.fullPath })
    const qc = useQueryClient()
    const { data: variant } = useSuspenseQuery(variantQuery(variantId))
    const { data: preps } = useSuspenseQuery(prepsQuery(variantId))
    const status = useQuery(aiStatusQuery())

    const current = preps.find((p) => p.id === selectedId) ?? preps.at(0)
    const [draft, setDraft] = useState<Draft>(EMPTY)
    const [saved, setSaved] = useState(true)
    const [copied, setCopied] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(() => {
        clearTimeout(timer.current)
        setDraft(
            current
                ? {
                      company: current.company,
                      role: current.role,
                      jobDescription: current.jobDescription,
                      notes: current.notes,
                  }
                : EMPTY,
        )
        setSaved(true)
    }, [current?.id])

    const refresh = () => qc.invalidateQueries({ queryKey: ['preps', variantId] })
    const save = async (d: Draft) => {
        if (!current) return
        await updatePrep({ data: { id: current.id, ...d } })
        setSaved(true)
        void refresh()
    }
    const edit = (patch: Partial<Draft>) => {
        const next = { ...draft, ...patch }
        setDraft(next)
        setSaved(false)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => void save(next), 700)
    }
    const flush = async () => {
        clearTimeout(timer.current)
        if (!saved) await save(draft)
    }

    const create = useMutation({
        mutationFn: () => createPrep({ data: { variantId } }),
        onSuccess: async ({ id }) => {
            await refresh()
            navigate({ search: { id } })
        },
    })
    const remove = useMutation({
        mutationFn: (id: string) => deletePrep({ data: { id } }),
        onSuccess: async () => {
            await refresh()
            navigate({ search: {} })
        },
    })
    const generate = useMutation({
        mutationFn: async () => {
            await flush()
            if (!current) throw new Error('Create a prep first')
            return generatePrep({ data: { id: current.id } })
        },
        onSuccess: () => {
            void refresh()
            void qc.invalidateQueries({ queryKey: ['gaps'] })
        },
    })

    const aiOk = status.data?.configured ?? false
    const result = current?.result ?? null
    const title = [draft.company, draft.role].filter(Boolean).join(', ') || variant.name

    return (
        <div className="flex h-dvh flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
                <Button asChild variant="ghost" size="icon" aria-label="Back to editor">
                    <Link to="/cv/$variantId" params={{ variantId }}>
                        <ArrowLeft />
                    </Link>
                </Button>
                <MessagesSquare className="text-muted-foreground size-4" />
                <h1 className="font-medium">Interview prep · {variant.name}</h1>
                {current && (
                    <span className="text-muted-foreground text-xs">{saved ? 'Saved' : 'Unsaved changes…'}</span>
                )}
                {result && (
                    <Button
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => {
                            void navigator.clipboard.writeText(prepToMarkdown(title, result, draft.notes))
                            setCopied(true)
                            setTimeout(() => setCopied(false), 1500)
                        }}
                    >
                        <ClipboardCopy /> {copied ? 'Copied' : 'Copy as text'}
                    </Button>
                )}
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(340px,440px)_1fr]">
                <nav className="min-h-0 overflow-y-auto border-r p-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="mb-2 w-full"
                        disabled={create.isPending}
                        onClick={async () => {
                            await flush()
                            create.mutate()
                        }}
                    >
                        <Plus /> New prep
                    </Button>
                    <ul className="space-y-0.5">
                        {preps.map((p) => (
                            <li key={p.id}>
                                <button
                                    className={cn(
                                        'w-full truncate rounded px-2 py-1.5 text-left text-sm',
                                        p.id === current?.id ? 'bg-accent font-medium' : 'hover:bg-accent/50',
                                    )}
                                    onClick={async () => {
                                        await flush()
                                        navigate({ search: { id: p.id } })
                                    }}
                                >
                                    {[p.company, p.role].filter(Boolean).join(' · ') || 'Untitled prep'}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {preps.length === 0 && (
                        <p className="text-muted-foreground px-2 text-xs">
                            No preps yet. A new prep fills in from the latest application linked to this CV.
                        </p>
                    )}
                </nav>

                {current ? (
                    <aside className="min-h-0 space-y-3 overflow-y-auto border-r p-4 text-sm">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1">
                                <Label htmlFor="company" className="text-muted-foreground text-xs font-normal">
                                    Company
                                </Label>
                                <Input
                                    id="company"
                                    value={draft.company}
                                    onChange={(e) => edit({ company: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="role" className="text-muted-foreground text-xs font-normal">
                                    Role
                                </Label>
                                <Input id="role" value={draft.role} onChange={(e) => edit({ role: e.target.value })} />
                            </div>
                            <div className="col-span-2 grid gap-1">
                                <Label htmlFor="jd" className="text-muted-foreground text-xs font-normal">
                                    Job description
                                </Label>
                                <Textarea
                                    id="jd"
                                    rows={8}
                                    value={draft.jobDescription}
                                    onChange={(e) => edit({ jobDescription: e.target.value })}
                                />
                            </div>
                        </div>
                        <Button
                            className="w-full"
                            disabled={!aiOk || generate.isPending || draft.jobDescription.trim().length < 40}
                            title={aiOk ? undefined : 'Set ANTHROPIC_API_KEY in .env to enable AI'}
                            onClick={() => {
                                if (result && !confirm('Replace the current questions and answers?')) return
                                generate.mutate()
                            }}
                        >
                            {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                            {generate.isPending
                                ? 'Preparing… (about a minute)'
                                : result
                                  ? 'Prepare again'
                                  : 'Prepare me for this interview'}
                        </Button>
                        {!aiOk && (
                            <p className="text-muted-foreground text-xs">
                                Set ANTHROPIC_API_KEY in .env to generate questions. You can still keep notes here.
                            </p>
                        )}
                        {generate.error && <p className="text-destructive">{generate.error.message}</p>}
                        <div className="grid gap-1">
                            <Label htmlFor="notes" className="text-muted-foreground text-xs font-normal">
                                My notes (stories to tell, names, things to look up)
                            </Label>
                            <Textarea
                                id="notes"
                                rows={10}
                                value={draft.notes}
                                onChange={(e) => edit({ notes: e.target.value })}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => {
                                if (confirm('Delete this interview prep?')) remove.mutate(current.id)
                            }}
                        >
                            <Trash2 /> Delete prep
                        </Button>
                    </aside>
                ) : (
                    <div className="text-muted-foreground p-8 text-sm">Create a prep to get started.</div>
                )}

                <section className="min-h-0 overflow-y-auto bg-muted/40 p-6">
                    {result ? (
                        <PrepResult prep={result} />
                    ) : (
                        current && (
                            <div className="text-muted-foreground mx-auto max-w-xl space-y-2 pt-10 text-center text-sm">
                                <MessagesSquare className="mx-auto size-8 opacity-40" />
                                <p>
                                    You'll get the questions this employer is likely to ask, the bullets from your CV
                                    that answer them, STAR outlines, the gaps to prepare for, and questions to ask them.
                                </p>
                            </div>
                        )
                    )}
                </section>
            </div>
        </div>
    )
}

function PrepResult({ prep }: { prep: InterviewPrep }) {
    const [filter, setFilter] = useState<Category | 'all'>('all')
    const counts = prep.questions.reduce<Partial<Record<Category, number>>>(
        (acc, q) => ({ ...acc, [q.category]: (acc[q.category] ?? 0) + 1 }),
        {},
    )
    const shown = prep.questions
        .map((q, i) => ({ q, n: i + 1 }))
        .filter(({ q }) => filter === 'all' || q.category === filter)

    return (
        <div className="mx-auto max-w-3xl space-y-6 text-sm">
            <div className="rounded-lg border bg-card p-4">
                <h2 className="mb-1 font-medium">Where you stand</h2>
                <p className="text-muted-foreground">{prep.fitSummary}</p>
            </div>

            <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="mr-2 font-medium">Likely questions</h2>
                    <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
                        All {prep.questions.length}
                    </Chip>
                    {(Object.keys(QUESTION_CATEGORIES) as Category[])
                        .filter((c) => counts[c])
                        .map((c) => (
                            <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
                                {QUESTION_CATEGORIES[c]} {counts[c]}
                            </Chip>
                        ))}
                </div>
                <ol className="space-y-3">
                    {shown.map(({ q, n }) => (
                        <li key={n} className="space-y-3 rounded-lg border bg-card p-4">
                            <div>
                                <span className="text-muted-foreground text-xs">
                                    {n}. {QUESTION_CATEGORIES[q.category]}
                                </span>
                                <p className="font-medium">{q.question}</p>
                                <p className="text-muted-foreground text-xs">{q.whyTheyAsk}</p>
                            </div>
                            {q.evidence.length > 0 ? (
                                <div className="space-y-1.5">
                                    <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                        Your evidence
                                    </h3>
                                    {q.evidence.map((e) => (
                                        <blockquote key={e.text} className="border-l-2 border-violet-300 pl-3">
                                            <p>{e.text}</p>
                                            <p className="text-muted-foreground text-xs">{e.where}</p>
                                        </blockquote>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-amber-700">
                                    Nothing on your CV answers this directly. Prepare an example.
                                </p>
                            )}
                            <details className="group rounded-md bg-muted/50 p-3" open={n <= 3}>
                                <summary className="cursor-pointer text-xs font-medium">Answer outline (STAR)</summary>
                                <dl className="mt-2 grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5">
                                    <dt className="text-muted-foreground">Situation</dt>
                                    <dd>{q.star.situation}</dd>
                                    <dt className="text-muted-foreground">Task</dt>
                                    <dd>{q.star.task}</dd>
                                    <dt className="text-muted-foreground">Action</dt>
                                    <dd>{q.star.action}</dd>
                                    <dt className="text-muted-foreground">Result</dt>
                                    <dd>{q.star.result}</dd>
                                </dl>
                            </details>
                            <p className="flex gap-2 text-xs">
                                <Lightbulb className="size-3.5 shrink-0 text-amber-600" />
                                {q.tip}
                            </p>
                        </li>
                    ))}
                </ol>
            </section>

            {prep.gaps.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2">
                        <h2 className="font-medium">Gaps to prepare for</h2>
                        <Link to="/gaps" className="text-muted-foreground ml-auto text-xs underline">
                            All skill gaps
                        </Link>
                    </div>
                    {prep.gaps.map((g) => (
                        <div key={g.skill} className="space-y-2 rounded-lg border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <Target className="size-4 text-rose-600" />
                                <span className="font-medium">{g.skill}</span>
                                <span
                                    className={cn(
                                        'rounded px-1.5 py-0.5 text-[11px]',
                                        g.importance === 'required'
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-zinc-100 text-zinc-700',
                                    )}
                                >
                                    {g.importance === 'required' ? 'Required' : 'Nice to have'}
                                </span>
                            </div>
                            <p className="text-muted-foreground border-l-2 pl-3 text-xs">{g.requirement}</p>
                            <p>
                                <span className="font-medium">Honest answer: </span>
                                {g.honestAnswer}
                            </p>
                            <p>
                                <span className="font-medium">Prepare: </span>
                                {g.howToPrepare}
                            </p>
                        </div>
                    ))}
                </section>
            )}

            <section className="space-y-2 rounded-lg border bg-card p-4">
                <h2 className="font-medium">Questions to ask them</h2>
                <ul className="list-disc space-y-1 pl-5">
                    {prep.questionsToAsk.map((q) => (
                        <li key={q}>{q}</li>
                    ))}
                </ul>
            </section>
        </div>
    )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs',
                active ? 'border-violet-300 bg-violet-100 text-violet-900' : 'bg-card hover:bg-muted',
            )}
            onClick={onClick}
        >
            {children}
        </button>
    )
}
