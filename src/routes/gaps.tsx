import { Link, createFileRoute } from '@tanstack/react-router'
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, Target } from 'lucide-react'
import { listGaps, setSkillStatus } from '#/server/gaps'
import { SKILL_STATUSES } from '#/cv/applications'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import type { SkillStatus } from '#/cv/applications'
import type { SkillGap } from '#/server/gaps'

const gapsQuery = () => queryOptions({ queryKey: ['gaps', 'all'], queryFn: () => listGaps() })

export const Route = createFileRoute('/gaps')({
    loader: ({ context }) => context.queryClient.ensureQueryData(gapsQuery()),
    head: () => ({ meta: [{ title: 'Skill gaps · CV Builder' }] }),
    component: GapsPage,
})

const STATUS_LABEL: Record<SkillStatus, string> = {
    open: 'To learn',
    learning: 'Learning',
    have: 'I have this',
    ignore: 'Ignore',
}
const STATUS_TONE: Record<SkillStatus, string> = {
    open: 'bg-rose-50 text-rose-900 border-rose-200',
    learning: 'bg-sky-50 text-sky-900 border-sky-200',
    have: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    ignore: 'bg-muted text-muted-foreground',
}

function GapsPage() {
    const { data: gaps } = useSuspenseQuery(gapsQuery())
    const [showDone, setShowDone] = useState(false)
    const active = gaps.filter((g) => g.status === 'open' || g.status === 'learning')
    const done = gaps.filter((g) => g.status === 'have' || g.status === 'ignore')
    const jobs = new Set(gaps.flatMap((g) => g.jobs.map((j) => j.applicationId))).size
    const maxScore = Math.max(1, ...gaps.map(scoreOf))

    return (
        <div className="min-h-dvh bg-muted/30">
            <header className="flex items-center gap-3 border-b bg-card px-4 py-2">
                <Button asChild variant="ghost" size="icon" aria-label="Back to all CVs">
                    <Link to="/">
                        <ArrowLeft />
                    </Link>
                </Button>
                <Target className="text-muted-foreground size-4" />
                <h1 className="font-medium">Skill gaps</h1>
                <span className="text-muted-foreground text-xs">
                    {active.length} to work on · from {jobs} job{jobs === 1 ? '' : 's'}
                </span>
                <Button asChild variant="ghost" size="sm" className="ml-auto">
                    <Link to="/applications">Applications</Link>
                </Button>
            </header>
            <main className="mx-auto max-w-4xl space-y-4 p-6 text-sm">
                <p className="text-muted-foreground">
                    Skills that jobs you're applying for ask for and your CV doesn't show, most in demand first.
                    Required counts double. Gaps come from the AI gap analysis, interview prep, or what you add on an
                    application.
                </p>
                {gaps.length === 0 ? (
                    <div className="rounded-lg border bg-card p-8 text-center">
                        <p className="font-medium">No gaps recorded yet</p>
                        <p className="text-muted-foreground mt-1">
                            Open an application and add skills it asks for, or use "Find gaps with AI".
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {active.map((g) => (
                            <GapRow key={g.key} gap={g} maxScore={maxScore} />
                        ))}
                    </ul>
                )}
                {done.length > 0 && (
                    <section className="space-y-2">
                        <button
                            className="text-muted-foreground flex items-center gap-1 text-xs font-medium"
                            onClick={() => setShowDone((s) => !s)}
                        >
                            {showDone ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            Covered or ignored ({done.length})
                        </button>
                        {showDone && (
                            <ul className="space-y-2 opacity-80">
                                {done.map((g) => (
                                    <GapRow key={g.key} gap={g} maxScore={maxScore} />
                                ))}
                            </ul>
                        )}
                    </section>
                )}
            </main>
        </div>
    )
}

const scoreOf = (g: SkillGap) => g.required * 2 + g.nice

function GapRow({ gap, maxScore }: { gap: SkillGap; maxScore: number }) {
    const qc = useQueryClient()
    const [open, setOpen] = useState(false)
    const [notes, setNotes] = useState(gap.notes)
    const update = useMutation({
        mutationFn: (patch: { status?: SkillStatus; notes?: string }) =>
            setSkillStatus({ data: { key: gap.key, ...patch } }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['gaps'] }),
    })
    const score = scoreOf(gap)

    return (
        <li className="rounded-lg border bg-card">
            <div className="flex items-center gap-3 p-3">
                <button
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={open}
                    onClick={() => setOpen((o) => !o)}
                >
                    {open ? (
                        <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                        <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <span className="font-medium">{gap.skill}</span>
                    <span className="text-muted-foreground truncate text-xs">
                        {[gap.required && `required by ${gap.required}`, gap.nice && `nice to have for ${gap.nice}`]
                            .filter(Boolean)
                            .join(', ')}
                    </span>
                </button>
                <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                    <div
                        className="h-full rounded-full bg-rose-400"
                        style={{ width: `${Math.max(8, (score / maxScore) * 100)}%` }}
                    />
                </div>
                <select
                    aria-label={`Status for ${gap.skill}`}
                    className={cn('h-8 rounded-md border px-2 text-xs', STATUS_TONE[gap.status])}
                    value={gap.status}
                    onChange={(e) => update.mutate({ status: e.target.value as SkillStatus })}
                >
                    {SKILL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                        </option>
                    ))}
                </select>
            </div>
            {open && (
                <div className="space-y-3 border-t p-3 pl-9">
                    <ul className="space-y-2">
                        {gap.jobs.map((j) => (
                            <li key={j.gapId}>
                                <div className="flex items-center gap-2">
                                    <Link to="/applications" className="font-medium hover:underline">
                                        {j.company}
                                    </Link>
                                    {j.role && <span className="text-muted-foreground">{j.role}</span>}
                                    <span
                                        className={cn(
                                            'rounded px-1.5 py-0.5 text-[11px]',
                                            j.importance === 'required'
                                                ? 'bg-rose-100 text-rose-800'
                                                : 'bg-zinc-100 text-zinc-700',
                                        )}
                                    >
                                        {j.importance === 'required' ? 'Required' : 'Nice to have'}
                                    </span>
                                </div>
                                {j.requirement && (
                                    <p className="text-muted-foreground mt-0.5 border-l-2 pl-2 text-xs">
                                        {j.requirement}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                    <Input
                        className="h-8"
                        placeholder="Plan or progress, e.g. course link, side project idea"
                        aria-label={`Notes for ${gap.skill}`}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        onBlur={() => notes !== gap.notes && update.mutate({ notes })}
                    />
                    {gap.status === 'have' && (
                        <p className="text-xs text-emerald-800">
                            If you have this, add it to your CV so it stops showing up as a gap.
                        </p>
                    )}
                </div>
            )}
        </li>
    )
}
