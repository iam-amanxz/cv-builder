import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Download, FileDown, History, Loader2, Save } from 'lucide-react'
import { exportsQuery, variantQuery } from '#/cv/queries'
import { updateVariant } from '#/server/variants'
import { exportPdf } from '#/server/export'
import { saveVersion } from '#/server/history'
import { resolveTokens } from '#/themes'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { CvEditor } from '#/components/editor/cv-editor'
import { Preview } from '#/components/editor/preview'
import { ThemePanel } from '#/components/editor/theme-panel'
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

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'
const AUTOSAVE_MS = 800

function EditorPage() {
    const { variantId } = Route.useParams()
    const { data: variant } = useSuspenseQuery(variantQuery(variantId))
    const qc = useQueryClient()

    const [doc, setDoc] = useState<CvDoc>(variant.doc)
    const [overrides, setOverrides] = useState<ThemeOverrides>(variant.themeOverrides)
    const [name, setName] = useState(variant.name)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [pages, setPages] = useState(1)

    // Latest unsaved values, so flush() can save without stale closures.
    const pending = useRef<{ doc?: CvDoc; themeOverrides?: ThemeOverrides; name?: string }>({})
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

    const flush = useCallback(async () => {
        clearTimeout(timer.current)
        const patch = pending.current
        if (!Object.keys(patch).length) return
        pending.current = {}
        setSaveState('saving')
        try {
            const { updatedAt } = await updateVariant({ data: { id: variantId, ...patch } })
            // Keep the cached variant in sync so re-opening the editor (or the
            // history page) sees what was just saved, not the copy from first load.
            qc.setQueryData(variantQuery(variantId).queryKey, (old) => (old ? { ...old, ...patch, updatedAt } : old))
            setSaveState(Object.keys(pending.current).length ? 'dirty' : 'saved')
            qc.invalidateQueries({ queryKey: ['variants'] })
        } catch (err) {
            pending.current = { ...patch, ...pending.current }
            setSaveState('error')
            throw err
        }
    }, [qc, variantId])

    const schedule = useCallback(
        (patch: typeof pending.current) => {
            pending.current = { ...pending.current, ...patch }
            setSaveState('dirty')
            clearTimeout(timer.current)
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

    const tokens = useMemo(() => resolveTokens(variant.themeId, overrides), [variant.themeId, overrides])

    const exportsList = useSuspenseQuery(exportsQuery(variantId))
    const pdf = useMutation({
        mutationFn: async () => {
            await flush()
            return exportPdf({ data: { variantId } })
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
                    <span className="text-muted-foreground text-xs">
                        {pages} page{pages > 1 ? 's' : ''}
                    </span>
                    {version.isSuccess && <span className="text-xs text-emerald-700">Version saved</span>}
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
                    <Button onClick={() => pdf.mutate()} disabled={pdf.isPending}>
                        {pdf.isPending ? <Loader2 className="animate-spin" /> : <FileDown />}
                        Export PDF
                    </Button>
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

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(420px,560px)_1fr]">
                <aside className="min-h-0 overflow-y-auto border-r p-4">
                    <CvEditor doc={doc} mutate={mutate} />
                    <ExportHistory items={exportsList.data} />
                </aside>
                <section className="flex min-h-0 flex-col bg-muted/60">
                    <div className="border-b bg-card/70 px-4 py-2">
                        <ThemePanel
                            themeId={variant.themeId}
                            tokens={tokens}
                            overrides={overrides}
                            onChange={(o) => {
                                setOverrides(o)
                                schedule({ themeOverrides: o })
                            }}
                        />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4">
                        <Preview doc={doc} themeId={variant.themeId} tokens={tokens} onPageCount={setPages} />
                    </div>
                </section>
            </div>
        </div>
    )
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
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
