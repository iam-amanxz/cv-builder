import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { ArrowLeft, ArrowRightLeft, Copy, FileDown, History, Pencil, RotateCcw, Save } from 'lucide-react'
import { snapshotQuery, snapshotsQuery, variantQuery } from '#/cv/queries'
import { forkVariant, renameSnapshot, restoreSnapshot, saveVersion } from '#/server/history'
import { diffCv } from '#/cv/diff'
import { getTheme, resolveTokens } from '#/themes'
import { Button } from '#/components/ui/button'
import { Preview } from '#/components/editor/preview'
import { DiffView } from '#/components/history/diff-view'
import { LocalTime } from '#/components/local-time'
import { cn } from '#/lib/utils'
import type { CvDoc } from '#/cv/schema'
import type { ThemeTokens } from '#/themes'

const CURRENT = 'current'

const searchSchema = z.object({
    /** Selected version: a snapshot id or "current". */
    v: z.string().optional(),
    tab: z.enum(['preview', 'changes']).optional(),
    /** Compare base ("from") for the changes tab. */
    from: z.string().optional(),
})

export const Route = createFileRoute('/cv/$variantId_/history')({
    validateSearch: searchSchema,
    loader: async ({ context, params }) => {
        const [variant] = await Promise.all([
            context.queryClient.ensureQueryData(variantQuery(params.variantId)),
            context.queryClient.ensureQueryData(snapshotsQuery(params.variantId)),
        ])
        return variant
    },
    head: ({ loaderData }) => ({
        meta: [{ title: `History · ${loaderData?.name ?? 'CV'} · CV Builder` }],
    }),
    component: HistoryPage,
})

const REASON_LABEL = {
    manual: 'Saved version',
    export: 'Exported',
    'ai-apply': 'Before AI change',
    restore: 'Before restore',
} as const

const REASON_STYLE = {
    manual: 'bg-info-wash text-info-ink',
    export: 'bg-ai-wash text-ai-ink',
    'ai-apply': 'bg-warn-wash text-warn-ink',
    restore: 'bg-muted text-foreground',
} as const

interface Version {
    doc: CvDoc
    tokens: ThemeTokens
    themeId: string
}

/** Load a version's content: the live working copy or a frozen snapshot. */
function useVersion(variantId: string, id: string | undefined): Version | undefined {
    const variant = useSuspenseQuery(variantQuery(variantId)).data
    const snap = useQuery({ ...snapshotQuery(id ?? ''), enabled: !!id && id !== CURRENT })
    if (!id) return undefined
    if (id === CURRENT) {
        return {
            doc: variant.doc,
            themeId: variant.themeId,
            tokens: resolveTokens(variant.themeId, variant.themeOverrides),
        }
    }
    return snap.data ? { doc: snap.data.doc, themeId: snap.data.themeId, tokens: snap.data.themeTokens } : undefined
}

function HistoryPage() {
    const { variantId } = Route.useParams()
    const search = Route.useSearch()
    const navigate = useNavigate({ from: Route.fullPath })
    const qc = useQueryClient()
    const { data: variant } = useSuspenseQuery(variantQuery(variantId))
    const { data: snapshots } = useSuspenseQuery(snapshotsQuery(variantId))

    const selected = search.v ?? CURRENT
    const tab = search.tab ?? 'preview'
    const selectedSnap = snapshots.find((s) => s.id === selected)
    // Default comparison: selected snapshot → current; current → latest snapshot.
    const defaultFrom = selected === CURRENT ? snapshots.at(0)?.id : selected
    const from = search.from ?? defaultFrom
    const to = selected === CURRENT || search.from ? selected : CURRENT
    const pair = from === to ? undefined : from

    const shown = useVersion(variantId, selected)
    const base = useVersion(variantId, pair)
    const target = useVersion(variantId, pair ? to : undefined)

    const diff = useMemo(
        () =>
            base && target
                ? diffCv(
                      { ...base, themeName: getTheme(base.themeId).name },
                      { ...target, themeName: getTheme(target.themeId).name },
                  )
                : undefined,
        [base, target],
    )

    const refresh = () => qc.invalidateQueries({ queryKey: ['snapshots', variantId] })

    const save = useMutation({
        mutationFn: (label: string) => saveVersion({ data: { variantId, label } }),
        onSuccess: async ({ id }) => {
            await refresh()
            navigate({ search: { v: id } })
        },
    })

    const rename = useMutation({
        mutationFn: (v: { id: string; label: string }) => renameSnapshot({ data: v }),
        onSuccess: refresh,
    })

    const restore = useMutation({
        mutationFn: (snapshotId: string) => restoreSnapshot({ data: { snapshotId } }),
        onSuccess: async () => {
            await Promise.all([
                qc.invalidateQueries({ queryKey: ['variant', variantId] }),
                qc.invalidateQueries({ queryKey: ['variants'] }),
                refresh(),
            ])
            navigate({ to: '/cv/$variantId', params: { variantId } })
        },
    })

    const fork = useMutation({
        mutationFn: (v: { name: string; snapshotId?: string }) =>
            forkVariant({
                data: v.snapshotId ? { name: v.name, snapshotId: v.snapshotId } : { name: v.name, variantId },
            }),
        onSuccess: async ({ id }) => {
            await qc.invalidateQueries({ queryKey: ['variants'] })
            navigate({ to: '/cv/$variantId', params: { variantId: id } })
        },
    })

    // Server renders UTC; switch to the viewer's local time after hydration
    // (matches <LocalTime> in the list, avoids a hydration mismatch).
    const [isClient, setIsClient] = useState(false)
    useEffect(() => setIsClient(true), [])
    const when = (d: Date | undefined) =>
        !d ? '' : isClient ? d.toLocaleString() : d.toISOString().slice(0, 16).replace('T', ' ')

    const titleFor = (id: string) => {
        if (id === CURRENT) return 'Current working copy'
        const s = snapshots.find((x) => x.id === id)
        return s ? s.label || REASON_LABEL[s.reason] : 'Unknown'
    }

    const error = save.error ?? rename.error ?? restore.error ?? fork.error

    return (
        <div className="flex h-dvh flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b-2 bg-card px-4 py-2">
                <Button asChild variant="ghost" size="icon" aria-label="Back to editor">
                    <Link to="/cv/$variantId" params={{ variantId }}>
                        <ArrowLeft />
                    </Link>
                </Button>
                <History className="text-muted-foreground size-4" />
                <h1 className="text-lg font-extrabold tracking-tight">History · {variant.name}</h1>
                <div className="ml-auto flex items-center gap-2">
                    <Button
                        variant="outline"
                        disabled={save.isPending}
                        onClick={() => {
                            const label = prompt('Name this version (optional)', '')
                            if (label !== null) save.mutate(label)
                        }}
                    >
                        <Save /> Save version
                    </Button>
                </div>
            </header>
            {error && <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm">{error.message}</div>}

            <div className="grid min-h-0 flex-1 md:grid-cols-[320px_1fr]">
                <aside className="min-h-0 overflow-y-auto border-r">
                    <ol className="divide-y divide-hairline">
                        <VersionRow
                            active={selected === CURRENT}
                            onSelect={() => navigate({ search: { tab } })}
                            title="Current working copy"
                            meta={
                                <>
                                    edited <LocalTime value={variant.updatedAt} />
                                </>
                            }
                        />
                        {snapshots.map((s) => (
                            <VersionRow
                                key={s.id}
                                active={selected === s.id}
                                onSelect={() => navigate({ search: { v: s.id, tab } })}
                                title={s.label || REASON_LABEL[s.reason]}
                                badge={
                                    <span className={cn('rounded px-1.5 py-0.5 text-[11px]', REASON_STYLE[s.reason])}>
                                        {REASON_LABEL[s.reason]}
                                    </span>
                                }
                                meta={<LocalTime value={s.createdAt} />}
                                files={s.exports}
                            />
                        ))}
                    </ol>
                    {snapshots.length === 0 && (
                        <p className="text-muted-foreground p-4 text-sm">
                            No saved versions yet. Use “Save version” or export a PDF; every export is saved
                            automatically.
                        </p>
                    )}
                </aside>

                <section className="flex min-h-0 flex-col bg-muted/60">
                    <div className="flex flex-wrap items-center gap-2 border-b bg-card/70 px-4 py-2">
                        <div className="bg-muted flex rounded-md p-0.5 text-sm">
                            {(['preview', 'changes'] as const).map((t) => (
                                <button
                                    key={t}
                                    className={cn(
                                        'rounded px-3 py-1 capitalize',
                                        tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground',
                                    )}
                                    onClick={() => navigate({ search: (s) => ({ ...s, tab: t }) })}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {tab === 'changes' && (
                            <div className="flex items-center gap-2 text-sm">
                                <select
                                    aria-label="Compare from"
                                    className="h-8 max-w-56 rounded-md border bg-background px-2"
                                    value={from ?? ''}
                                    onChange={(e) => navigate({ search: (s) => ({ ...s, from: e.target.value }) })}
                                >
                                    {[CURRENT, ...snapshots.map((s) => s.id)].map((id) => (
                                        <option key={id} value={id}>
                                            {titleFor(id)}
                                            {id !== CURRENT
                                                ? ` · ${when(snapshots.find((s) => s.id === id)?.createdAt)}`
                                                : ''}
                                        </option>
                                    ))}
                                </select>
                                <ArrowRightLeft className="text-muted-foreground size-4" />
                                <span className="font-medium">{titleFor(to)}</span>
                            </div>
                        )}

                        <div className="ml-auto flex items-center gap-2">
                            {selectedSnap && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            const label = prompt('Rename version', selectedSnap.label)
                                            if (label !== null) rename.mutate({ id: selectedSnap.id, label })
                                        }}
                                    >
                                        <Pencil /> Rename
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={restore.isPending}
                                        onClick={() => {
                                            if (
                                                confirm(
                                                    'Replace the working copy with this version? The current state is saved as a version first, so you can undo this.',
                                                )
                                            )
                                                restore.mutate(selectedSnap.id)
                                        }}
                                    >
                                        <RotateCcw /> Restore
                                    </Button>
                                </>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={fork.isPending}
                                onClick={() => {
                                    const name = prompt('Name for the new CV', `${variant.name} (copy)`)
                                    if (name?.trim()) fork.mutate({ name: name.trim(), snapshotId: selectedSnap?.id })
                                }}
                            >
                                <Copy /> Copy to new CV
                            </Button>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4">
                        {tab === 'preview' ? (
                            shown ? (
                                <Preview doc={shown.doc} themeId={shown.themeId} tokens={shown.tokens} />
                            ) : (
                                <Loading />
                            )
                        ) : !pair ? (
                            <p className="text-muted-foreground py-10 text-center text-sm">
                                {snapshots.length === 0
                                    ? 'Nothing to compare yet. Save or export a version first.'
                                    : 'Pick a different version to compare against.'}
                            </p>
                        ) : diff ? (
                            <div className="mx-auto max-w-3xl py-6">
                                <DiffView diff={diff} />
                            </div>
                        ) : (
                            <Loading />
                        )}
                    </div>
                </section>
            </div>
        </div>
    )
}

function Loading() {
    return <p className="text-muted-foreground py-10 text-center text-sm">Loading…</p>
}

function VersionRow({
    active,
    onSelect,
    title,
    badge,
    meta,
    files,
}: {
    active: boolean
    onSelect: () => void
    title: string
    badge?: React.ReactNode
    meta: React.ReactNode
    files?: { id: string; format: string; fileName: string }[]
}) {
    return (
        <li>
            <div
                role="button"
                tabIndex={0}
                onClick={onSelect}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
                className={cn(
                    'block w-full cursor-pointer px-4 py-3 text-left',
                    active ? 'bg-accent' : 'hover:bg-accent/50',
                )}
                aria-current={active || undefined}
            >
                <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
                    {badge}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">{meta}</div>
                {files && files.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {files.map((f) => (
                            <a
                                key={f.id}
                                href={`/api/exports/${f.id}?inline`}
                                target="_blank"
                                rel="noreferrer"
                                title={f.fileName}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[11px] uppercase hover:bg-muted"
                            >
                                <FileDown className="size-3" /> {f.format}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </li>
    )
}
