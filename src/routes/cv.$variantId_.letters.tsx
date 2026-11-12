import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { ArrowLeft, ClipboardCopy, FileDown, Loader2, Mail, Plus, Sparkles, Trash2 } from 'lucide-react'
import { aiStatusQuery, lettersQuery, variantQuery } from '#/cv/queries'
import { createLetter, deleteLetter, generateLetter, updateLetter } from '#/server/letters'
import { resolveTokens } from '#/themes'
import { Letter, letterDate } from '#/themes/letter'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/cv/$variantId_/letters')({
    validateSearch: z.object({ id: z.string().optional() }),
    loader: async ({ context, params }) => {
        const [variant] = await Promise.all([
            context.queryClient.ensureQueryData(variantQuery(params.variantId)),
            context.queryClient.ensureQueryData(lettersQuery(params.variantId)),
        ])
        return variant
    },
    head: ({ loaderData }) => ({ meta: [{ title: `Cover letters · ${loaderData?.name ?? 'CV'} · CV Builder` }] }),
    component: LettersPage,
})

type Draft = { company: string; role: string; recipient: string; jobDescription: string; body: string }
const EMPTY: Draft = { company: '', role: '', recipient: '', jobDescription: '', body: '' }

function LettersPage() {
    const { variantId } = Route.useParams()
    const { id: selectedId } = Route.useSearch()
    const navigate = useNavigate({ from: Route.fullPath })
    const qc = useQueryClient()
    const { data: variant } = useSuspenseQuery(variantQuery(variantId))
    const { data: letters } = useSuspenseQuery(lettersQuery(variantId))
    const status = useQuery(aiStatusQuery())

    const current = letters.find((l) => l.id === selectedId) ?? letters.at(0)
    const [draft, setDraft] = useState<Draft>(EMPTY)
    const [tone, setTone] = useState<'professional' | 'warm' | 'concise'>('professional')
    const [saved, setSaved] = useState(true)
    const [date, setDate] = useState('')
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

    // Load the selected letter into the form.
    useEffect(() => {
        clearTimeout(timer.current)
        setDraft(
            current
                ? {
                      company: current.company,
                      role: current.role,
                      recipient: current.recipient,
                      jobDescription: current.jobDescription,
                      body: current.body,
                  }
                : EMPTY,
        )
        setSaved(true)
    }, [current?.id])
    useEffect(() => setDate(letterDate()), [])

    const refresh = () => qc.invalidateQueries({ queryKey: ['letters', variantId] })

    const save = async (d: Draft) => {
        if (!current) return
        await updateLetter({ data: { id: current.id, ...d } })
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
        mutationFn: () => createLetter({ data: { variantId } }),
        onSuccess: async ({ id }) => {
            await refresh()
            navigate({ search: { id } })
        },
    })
    const remove = useMutation({
        mutationFn: (id: string) => deleteLetter({ data: { id } }),
        onSuccess: async () => {
            await refresh()
            navigate({ search: {} })
        },
    })
    const generate = useMutation({
        mutationFn: () =>
            generateLetter({
                data: {
                    variantId,
                    doc: variant.doc,
                    company: draft.company,
                    role: draft.role,
                    recipient: draft.recipient,
                    jobDescription: draft.jobDescription,
                    tone,
                },
            }),
        onSuccess: ({ body }) => edit({ body }),
    })

    const tokens = resolveTokens(variant.themeId, variant.themeOverrides)
    const aiOk = status.data?.configured ?? false

    return (
        <div className="flex h-dvh flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b-2 bg-card px-4 py-2">
                <Button asChild variant="ghost" size="icon" aria-label="Back to editor">
                    <Link to="/cv/$variantId" params={{ variantId }}>
                        <ArrowLeft />
                    </Link>
                </Button>
                <Mail className="text-muted-foreground size-4" />
                <h1 className="text-lg font-extrabold tracking-tight">Cover letters · {variant.name}</h1>
                {current && (
                    <span className="text-muted-foreground text-xs">{saved ? 'Saved' : 'Unsaved changes…'}</span>
                )}
                {current && (
                    <div className="ml-auto flex items-center gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => void navigator.clipboard.writeText(draft.body)}
                            disabled={!draft.body}
                        >
                            <ClipboardCopy /> Copy text
                        </Button>
                        <Button
                            disabled={!draft.body}
                            onClick={async () => {
                                await flush()
                                window.location.assign(`/api/letters/${current.id}/pdf`)
                            }}
                        >
                            <FileDown /> Download PDF
                        </Button>
                    </div>
                )}
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(380px,520px)_1fr]">
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
                        <Plus /> New letter
                    </Button>
                    <ul className="space-y-0.5">
                        {letters.map((l) => (
                            <li key={l.id}>
                                <button
                                    className={cn(
                                        'w-full truncate rounded px-2 py-1.5 text-left text-sm',
                                        l.id === current?.id ? 'bg-accent font-medium' : 'hover:bg-accent/50',
                                    )}
                                    onClick={async () => {
                                        await flush()
                                        navigate({ search: { id: l.id } })
                                    }}
                                >
                                    {[l.company, l.role].filter(Boolean).join(' · ') || 'Untitled letter'}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {letters.length === 0 && (
                        <p className="text-muted-foreground px-2 text-xs">No letters yet for this CV.</p>
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
                                <Label htmlFor="recipient" className="text-muted-foreground text-xs font-normal">
                                    Recipient (optional)
                                </Label>
                                <Input
                                    id="recipient"
                                    placeholder="Hiring Manager"
                                    value={draft.recipient}
                                    onChange={(e) => edit({ recipient: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2 grid gap-1">
                                <Label htmlFor="jd" className="text-muted-foreground text-xs font-normal">
                                    Job description
                                </Label>
                                <Textarea
                                    id="jd"
                                    rows={5}
                                    value={draft.jobDescription}
                                    onChange={(e) => edit({ jobDescription: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                aria-label="Tone"
                                className="h-9 rounded-md border bg-background px-2"
                                value={tone}
                                onChange={(e) => setTone(e.target.value as typeof tone)}
                            >
                                <option value="professional">Professional</option>
                                <option value="warm">Warm</option>
                                <option value="concise">Concise</option>
                            </select>
                            <Button
                                className="flex-1"
                                disabled={!aiOk || generate.isPending || draft.jobDescription.trim().length < 40}
                                title={aiOk ? undefined : 'Set ANTHROPIC_API_KEY in .env to enable AI'}
                                onClick={() => {
                                    if (draft.body.trim() && !confirm('Replace the current letter text?')) return
                                    generate.mutate()
                                }}
                            >
                                {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                                {draft.body ? 'Regenerate with AI' : 'Write with AI'}
                            </Button>
                        </div>
                        {generate.error && <p className="text-destructive">{generate.error.message}</p>}
                        <div className="grid gap-1">
                            <Label htmlFor="body" className="text-muted-foreground text-xs font-normal">
                                Letter (blank line between paragraphs)
                            </Label>
                            <Textarea
                                id="body"
                                rows={18}
                                value={draft.body}
                                onChange={(e) => edit({ body: e.target.value })}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => {
                                if (confirm('Delete this letter?')) remove.mutate(current.id)
                            }}
                        >
                            <Trash2 /> Delete letter
                        </Button>
                    </aside>
                ) : (
                    <div className="text-muted-foreground p-8 text-sm">Create a letter to get started.</div>
                )}

                <section className="min-h-0 overflow-y-auto bg-muted/60 p-6">
                    {current && (
                        <div className="mx-auto max-w-[210mm] bg-white p-[18mm] shadow-hard-lg ring-2 ring-foreground">
                            <Letter
                                doc={variant.doc}
                                tokens={tokens}
                                company={draft.company}
                                role={draft.role}
                                recipient={draft.recipient}
                                body={draft.body}
                                date={date}
                            />
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
