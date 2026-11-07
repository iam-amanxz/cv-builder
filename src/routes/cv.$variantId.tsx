import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    ArrowLeft,
    ChevronDown,
    Download,
    FileDown,
    History,
    Loader2,
    Mail,
    Minimize2,
    Save,
    ScanText,
    Sparkles,
    TriangleAlert,
} from 'lucide-react'
import { aiStatusQuery, exportsQuery, variantQuery } from '#/cv/queries'
import { SAVE_CONFLICT } from '#/cv/errors'
import { updateVariant } from '#/server/variants'
import { exportFile } from '#/server/export'
import { saveVersion } from '#/server/history'
import { snapshotBeforeAi } from '#/ai/tasks'
import { AiProvider } from '#/components/ai/ai-context'
import { resolveTokens } from '#/themes'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { CvEditor } from '#/components/editor/cv-editor'
import { Preview } from '#/components/editor/preview'
import { ThemePanel } from '#/components/editor/theme-panel'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { tightenStep } from '#/components/editor/fit'
import { AtsPanel } from '#/components/editor/ats-panel'
import type { PageLayout } from '#/components/editor/preview'
import type { ExportFormat } from '#/server/export'
import { LocalTime } from '#/components/local-time'
import type { CvDoc } from '#/cv/schema'
import type { ThemeOverrides } from '#/themes'

export const Route = createFileRoute('/cv/$variantId')({
    loader: async ({ context, params }) => {
        const [variant] = await Promise.all([
            context.queryClient.ensureQueryData(variantQuery(params.variantId)),
            context.queryClient.ensureQueryData(exportsQuery(params.variantId)),
        ])
        return variant
    },
    head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.name ?? 'CV'} · CV Builder` }] }),
    component: EditorPage,
})

type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'
const AUTOSAVE_MS = 800

function EditorPage() {
    const { variantId } = Route.useParams()
    const { data: variant } = useSuspenseQuery(variantQuery(variantId))
    const qc = useQueryClient()

    const [doc, setDoc] = useState<CvDoc>(variant.doc)
    const [overrides, setOverrides] = useState<ThemeOverrides>(variant.themeOverrides)
    const [themeId, setThemeId] = useState(variant.themeId)
    const [name, setName] = useState(variant.name)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [layout, setLayout] = useState<PageLayout>({ pages: 1, spillLines: 0 })

    // Latest unsaved values, so flush() can save without stale closures.
    const pending = useRef<{ doc?: CvDoc; themeOverrides?: ThemeOverrides; themeId?: string; name?: string }>({})
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
    // Version this editor last loaded or saved. Saves are conditional on it, so a
    // stale tab can't overwrite changes made elsewhere (another tab, a restore, a script).
    const base = useRef(variant.updatedAt.getTime())
    const conflicted = useRef(false)
    // Saves run one at a time, each starting from the previous one's version.
    const chain = useRef<Promise<void>>(Promise.resolve())

    const saveNow = useCallback(async () => {
        clearTimeout(timer.current)
        const patch = pending.current
        if (!Object.keys(patch).length) return
        if (conflicted.current) throw new Error(SAVE_CONFLICT)
        pending.current = {}
        setSaveState('saving')
        try {
            const { updatedAt } = await updateVariant({
                data: { id: variantId, baseUpdatedAt: base.current, ...patch },
            })
            base.current = updatedAt.getTime()
            // Keep the cached variant in sync so re-opening the editor (or the
            // history page) sees what was just saved, not the copy from first load.
            qc.setQueryData(variantQuery(variantId).queryKey, (old) => (old ? { ...old, ...patch, updatedAt } : old))
            setSaveState(Object.keys(pending.current).length ? 'dirty' : 'saved')
            qc.invalidateQueries({ queryKey: ['variants'] })
        } catch (err) {
            pending.current = { ...patch, ...pending.current }
            if (err instanceof Error && err.message === SAVE_CONFLICT) {
                conflicted.current = true
                setSaveState('conflict')
            } else setSaveState('error')
            throw err
        }
    }, [qc, variantId])

    const flush = useCallback(() => {
        const run = chain.current.catch(() => {}).then(saveNow)
        chain.current = run
        return run
    }, [saveNow])

    const schedule = useCallback(
        (patch: typeof pending.current) => {
            pending.current = { ...pending.current, ...patch }
            clearTimeout(timer.current)
            if (conflicted.current) return
            setSaveState('dirty')
            timer.current = setTimeout(() => void flush().catch(() => {}), AUTOSAVE_MS)
        },
        [flush],
    )

    // Save on tab close / navigation away.
    useEffect(() => {
        const onHide = () => void flush().catch(() => {})
        window.addEventListener('pagehide', onHide)
        return () => {
            window.removeEventListener('pagehide', onHide)
            onHide()
        }
    }, [flush])

    const mutate = useCallback(
        (fn: (draft: CvDoc) => void) => {
            setDoc((prev) => {
                const next = structuredClone(prev)
                fn(next)
                schedule({ doc: next })
                return next
            })
        },
        [schedule],
    )

    const tokens = useMemo(() => resolveTokens(themeId, overrides), [themeId, overrides])

    // Fit to page: tighten one step at a time, letting the preview re-measure
    // between steps, until the page count drops to the target.
    const [fitTarget, setFitTarget] = useState<number | null>(null)
    const [fitMsg, setFitMsg] = useState('')
    const layoutRef = useRef(layout)
    layoutRef.current = layout
    useEffect(() => {
        if (fitTarget === null) return
        const t = setTimeout(() => {
            if (layoutRef.current.pages <= fitTarget) {
                setFitTarget(null)
                setFitMsg(`Fits on ${fitTarget} page${fitTarget > 1 ? 's' : ''}`)
                return
            }
            const next = tightenStep(tokens, overrides)
            if (!next) {
                setFitTarget(null)
                setFitMsg('Could not fit by spacing alone — hide or shorten an entry')
                return
            }
            setOverrides(next)
            schedule({ themeOverrides: next })
        }, 80)
        return () => clearTimeout(t)
    }, [fitTarget, tokens, overrides, schedule])
    const [atsOpen, setAtsOpen] = useState(false)

    const exportsList = useSuspenseQuery(exportsQuery(variantId))
    const pdf = useMutation({
        mutationFn: async (format: ExportFormat) => {
            await flush()
            return exportFile({ data: { variantId, format } })
        },
        onSuccess: ({ id }) => {
            qc.invalidateQueries({ queryKey: ['exports', variantId] })
            qc.invalidateQueries({ queryKey: ['snapshots', variantId] })
            window.location.assign(`/api/exports/${id}`)
        },
    })

    const navigate = useNavigate()
    const version = useMutation({
        mutationFn: async (label: string) => {
            await flush()
            return saveVersion({ data: { variantId, label } })
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['snapshots', variantId] }),
    })
    const aiStatus = useQuery(aiStatusQuery())
    const aiCtx = useMemo(
        () => ({
            variantId,
            enabled: aiStatus.data?.configured ?? false,
            model: aiStatus.data?.model ?? '',
            beforeApply: async (label: string) => {
                await flush()
                await snapshotBeforeAi({ data: { variantId, label } })
                void qc.invalidateQueries({ queryKey: ['snapshots', variantId] })
            },
        }),
        [variantId, aiStatus.data, flush, qc],
    )
    const openTailor = async () => {
        await flush().catch(() => {})
        navigate({ to: '/cv/$variantId/tailor', params: { variantId } })
    }
    const openLetters = async () => {
        await flush().catch(() => {})
        navigate({ to: '/cv/$variantId/letters', params: { variantId } })
    }
    const openHistory = async () => {
        await flush().catch(() => {})
        navigate({ to: '/cv/$variantId/history', params: { variantId } })
    }

    return (
        <div className="flex h-dvh flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
                <Button asChild variant="ghost" size="icon" aria-label="Back to all CVs">
                    <Link to="/">
                        <ArrowLeft />
                    </Link>
                </Button>
                <Input
                    className="h-8 w-56 font-medium"
                    value={name}
                    aria-label="CV name"
                    onChange={(e) => {
                        setName(e.target.value)
                        if (e.target.value.trim()) schedule({ name: e.target.value.trim() })
                    }}
                />
                <SaveBadge state={saveState} onRetry={() => void flush().catch(() => {})} />
                <div className="ml-auto flex items-center gap-3">
                    {layout.spillLines > 0 ? (
                        <span
                            className="inline-flex items-center gap-1 text-xs text-amber-700"
                            title="The last page is nearly empty. Tighten spacing, text size or margins, or hide an item to save a page."
                        >
                            <TriangleAlert className="size-3.5" />
                            Spills onto page {layout.pages} by ~{layout.spillLines} line
                            {layout.spillLines > 1 ? 's' : ''}
                        </span>
                    ) : null}
                    {layout.spillLines > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={fitTarget !== null}
                            onClick={() => {
                                setFitMsg('')
                                setFitTarget(layout.pages - 1)
                            }}
                        >
                            {fitTarget !== null ? <Loader2 className="animate-spin" /> : <Minimize2 />}
                            Fit to {layout.pages - 1} page{layout.pages - 1 > 1 ? 's' : ''}
                        </Button>
                    )}
                    {layout.spillLines > 0 ? null : (
                        <span className="text-muted-foreground text-xs">
                            {layout.pages} page{layout.pages > 1 ? 's' : ''}
                        </span>
                    )}
                    {fitMsg && fitTarget === null && <span className="text-muted-foreground text-xs">{fitMsg}</span>}
                    {version.isSuccess && <span className="text-xs text-emerald-700">Version saved</span>}
                    <Button variant="ghost" onClick={() => setAtsOpen((o) => !o)}>
                        <ScanText /> ATS check
                    </Button>
                    <Button variant="ghost" className="text-violet-700" onClick={() => void openTailor()}>
                        <Sparkles /> Tailor to job
                    </Button>
                    <Button variant="ghost" onClick={() => void openLetters()}>
                        <Mail /> Letters
                    </Button>
                    <Button variant="ghost" onClick={() => void openHistory()}>
                        <History /> History
                    </Button>
                    <Button
                        variant="outline"
                        disabled={version.isPending}
                        onClick={() => {
                            const label = prompt('Name this version (optional)', '')
                            if (label !== null) version.mutate(label)
                        }}
                    >
                        <Save /> Save version
                    </Button>
                    <div className="flex">
                        <Button className="rounded-r-none" onClick={() => pdf.mutate('pdf')} disabled={pdf.isPending}>
                            {pdf.isPending ? <Loader2 className="animate-spin" /> : <FileDown />}
                            Export PDF
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    className="rounded-l-none border-l border-primary-foreground/20 px-2"
                                    disabled={pdf.isPending}
                                    aria-label="More export formats"
                                >
                                    <ChevronDown />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Export as</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => pdf.mutate('pdf')}>PDF</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => pdf.mutate('docx')}>
                                    Word (.docx) — single-column, ATS-safe
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => pdf.mutate('md')}>Markdown</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => pdf.mutate('json')}>JSON Resume</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>
            {version.isError && (
                <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm">
                    Saving version failed: {version.error.message}
                </div>
            )}
            {pdf.isError && (
                <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm">
                    Export failed: {pdf.error.message}
                </div>
            )}

            <div className="relative grid min-h-0 flex-1 lg:grid-cols-[minmax(420px,560px)_1fr]">
                {atsOpen && (
                    <AtsPanel variantId={variantId} beforeRun={() => flush()} onClose={() => setAtsOpen(false)} />
                )}
                <aside className="min-h-0 overflow-y-auto border-r p-4">
                    <AiProvider value={aiCtx}>
                        <CvEditor doc={doc} mutate={mutate} />
                    </AiProvider>
                    <ExportHistory items={exportsList.data} />
                </aside>
                <section className="flex min-h-0 flex-col bg-muted/60">
                    <div className="border-b bg-card/70 px-4 py-2">
                        <ThemePanel
                            themeId={themeId}
                            tokens={tokens}
                            overrides={overrides}
                            onChange={(next) => {
                                setThemeId(next.themeId)
                                setOverrides(next.overrides)
                                schedule({ themeId: next.themeId, themeOverrides: next.overrides })
                            }}
                        />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4">
                        <Preview doc={doc} themeId={themeId} tokens={tokens} onLayout={setLayout} />
                    </div>
                </section>
            </div>
        </div>
    )
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
    if (state === 'conflict')
        return (
            <button
                className="text-destructive text-xs underline"
                title="Your edits here were not saved. Reload to load the latest version."
                onClick={() => window.location.reload()}
            >
                Changed elsewhere — reload
            </button>
        )
    if (state === 'error')
        return (
            <button className="text-destructive text-xs underline" onClick={onRetry}>
                Save failed — retry
            </button>
        )
    const text = { saved: 'All changes saved', dirty: 'Unsaved changes…', saving: 'Saving…' }[state]
    return <span className="text-muted-foreground text-xs">{text}</span>
}

function ExportHistory({
    items,
}: {
    items: { id: string; fileName: string; bytes: number; createdAt: Date; format: string }[]
}) {
    if (!items.length) return null
    return (
        <div className="mt-6">
            <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Recent exports</h2>
            <ul className="divide-y rounded-lg border bg-card text-sm">
                {items.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate" title={e.fileName}>
                            <LocalTime value={e.createdAt} />
                        </span>
                        <span className="text-muted-foreground text-xs uppercase">{e.format}</span>
                        <span className="text-muted-foreground text-xs">{Math.round(e.bytes / 1024)} KB</span>
                        <a
                            className="hover:bg-accent rounded p-1"
                            href={`/api/exports/${e.id}?inline`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open"
                        >
                            <Download className="size-4" />
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    )
}
