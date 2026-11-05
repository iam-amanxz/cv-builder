import { Link, createFileRoute } from '@tanstack/react-router'
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, ExternalLink, FileDown, History, Plus, Trash2, X } from 'lucide-react'
import {
    applicationOptions,
    createApplication,
    deleteApplication,
    listApplications,
    updateApplication,
} from '#/server/applications'
import { APPLICATION_STATUSES } from '#/cv/applications'
import { hrefFor } from '#/cv/format'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'

type Status = (typeof APPLICATION_STATUSES)[number]

const appsQuery = () => queryOptions({ queryKey: ['applications'], queryFn: () => listApplications() })
const optionsQuery = () => queryOptions({ queryKey: ['application-options'], queryFn: () => applicationOptions() })

export const Route = createFileRoute('/applications')({
    loader: ({ context }) => context.queryClient.ensureQueryData(appsQuery()),
    head: () => ({ meta: [{ title: 'Applications · CV Builder' }] }),
    component: ApplicationsPage,
})

const STATUS_LABEL: Record<Status, string> = {
    draft: 'To apply',
    applied: 'Applied',
    interview: 'Interviewing',
    offer: 'Offer',
    rejected: 'Rejected',
    ghosted: 'No reply',
}
const STATUS_TONE: Record<Status, string> = {
    draft: 'border-t-zinc-400',
    applied: 'border-t-sky-500',
    interview: 'border-t-violet-500',
    offer: 'border-t-emerald-500',
    rejected: 'border-t-rose-400',
    ghosted: 'border-t-amber-400',
}

interface FormState {
    id?: string
    company: string
    role: string
    url: string
    variantId: string | null
    exportId: string | null
    letterId: string | null
    status: Status
    appliedAt: string
    notes: string
}

const blank = (): FormState => ({
    company: '',
    role: '',
    url: '',
    variantId: null,
    exportId: null,
    letterId: null,
    status: 'draft',
    appliedAt: '',
    notes: '',
})

const selectCls = 'h-9 w-full rounded-md border bg-background px-2 text-sm'

function ApplicationsPage() {
    const { data: apps } = useSuspenseQuery(appsQuery())
    const qc = useQueryClient()
    const [form, setForm] = useState<FormState | null>(null)
    const refresh = () => qc.invalidateQueries({ queryKey: ['applications'] })

    const move = useMutation({
        mutationFn: (v: { id: string; status: Status }) =>
            updateApplication({
                data: {
                    id: v.id,
                    status: v.status,
                    ...(v.status === 'applied' ? { appliedAt: new Date().toISOString().slice(0, 10) } : {}),
                },
            }),
        onSuccess: refresh,
    })

    return (
        <div className="flex h-dvh flex-col">
            <header className="flex items-center gap-3 border-b bg-card px-4 py-2">
                <Button asChild variant="ghost" size="icon" aria-label="Back to all CVs">
                    <Link to="/">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="font-medium">Applications</h1>
                <span className="text-muted-foreground text-xs">{apps.length} total</span>
                <Button className="ml-auto" onClick={() => setForm(blank())}>
                    <Plus /> New application
                </Button>
            </header>
            <div className="flex min-h-0 flex-1">
                <div className="grid min-w-0 flex-1 auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 overflow-x-auto p-4">
                    {APPLICATION_STATUSES.map((status) => {
                        const items = apps.filter((a) => a.app.status === status)
                        return (
                            <section
                                key={status}
                                aria-label={STATUS_LABEL[status]}
                                className={cn(
                                    'flex min-h-0 flex-col rounded-lg border border-t-4 bg-muted/50',
                                    STATUS_TONE[status],
                                )}
                            >
                                <h2 className="flex items-center justify-between px-3 py-2 text-sm font-medium">
                                    {STATUS_LABEL[status]}
                                    <span className="text-muted-foreground text-xs">{items.length}</span>
                                </h2>
                                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                                    {items.map(({ app, variantName, exportFile, exportFormat, snapshotId }) => (
                                        <li
                                            key={app.id}
                                            className="space-y-1.5 rounded-md border bg-card p-2.5 text-sm shadow-xs"
                                        >
                                            <button
                                                className="block w-full text-left"
                                                onClick={() =>
                                                    setForm({
                                                        id: app.id,
                                                        company: app.company,
                                                        role: app.role,
                                                        url: app.url,
                                                        variantId: app.variantId,
                                                        exportId: app.exportId,
                                                        letterId: app.letterId,
                                                        status: app.status,
                                                        appliedAt: app.appliedAt,
                                                        notes: app.notes,
                                                    })
                                                }
                                            >
                                                <div className="font-medium">{app.company}</div>
                                                {app.role && <div className="text-muted-foreground">{app.role}</div>}
                                            </button>
                                            {app.appliedAt && (
                                                <div className="text-muted-foreground text-xs">
                                                    Applied {app.appliedAt}
                                                </div>
                                            )}
                                            {(exportFile || variantName) && (
                                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                                    {exportFile && app.exportId && (
                                                        <a
                                                            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 uppercase hover:bg-muted"
                                                            href={`/api/exports/${app.exportId}?inline`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            title={`Sent: ${exportFile}`}
                                                        >
                                                            <FileDown className="size-3" /> {exportFormat}
                                                        </a>
                                                    )}
                                                    {snapshotId && app.variantId && (
                                                        <Link
                                                            to="/cv/$variantId/history"
                                                            params={{ variantId: app.variantId }}
                                                            search={{ v: snapshotId }}
                                                            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 hover:bg-muted"
                                                            title="The exact version that was sent"
                                                        >
                                                            <History className="size-3" /> version
                                                        </Link>
                                                    )}
                                                    {!exportFile && variantName && (
                                                        <span className="text-muted-foreground">CV: {variantName}</span>
                                                    )}
                                                </div>
                                            )}
                                            <select
                                                aria-label={`Status for ${app.company}`}
                                                className="h-7 w-full rounded border bg-background px-1 text-xs"
                                                value={app.status}
                                                onChange={(e) =>
                                                    move.mutate({ id: app.id, status: e.target.value as Status })
                                                }
                                            >
                                                {APPLICATION_STATUSES.map((s) => (
                                                    <option key={s} value={s}>
                                                        {STATUS_LABEL[s]}
                                                    </option>
                                                ))}
                                            </select>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )
                    })}
                </div>
                {form && <ApplicationForm form={form} setForm={setForm} onDone={refresh} />}
            </div>
        </div>
    )
}

function ApplicationForm({
    form,
    setForm,
    onDone,
}: {
    form: FormState
    setForm: (f: FormState | null) => void
    onDone: () => Promise<unknown>
}) {
    const options = useQuery(optionsQuery())
    const set = <TKey extends keyof FormState>(k: TKey, v: FormState[TKey]) => setForm({ ...form, [k]: v })
    const exports = options.data?.exports.filter((e) => e.variantId === form.variantId) ?? []
    const letters = options.data?.letters.filter((l) => l.variantId === form.variantId) ?? []

    const save = useMutation({
        mutationFn: async () => {
            const { id, ...data } = form
            if (id) await updateApplication({ data: { id, ...data } })
            else await createApplication({ data })
        },
        onSuccess: async () => {
            await onDone()
            setForm(null)
        },
    })
    const remove = useMutation({
        mutationFn: (id: string) => deleteApplication({ data: { id } }),
        onSuccess: async () => {
            await onDone()
            setForm(null)
        },
    })

    return (
        <aside className="w-96 shrink-0 space-y-3 overflow-y-auto border-l bg-card p-4 text-sm">
            <div className="flex items-center justify-between">
                <h2 className="font-medium">{form.id ? 'Edit application' : 'New application'}</h2>
                <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setForm(null)}>
                    <X />
                </Button>
            </div>
            <div className="grid gap-1">
                <Label htmlFor="a-company">Company</Label>
                <Input id="a-company" value={form.company} onChange={(e) => set('company', e.target.value)} />
            </div>
            <div className="grid gap-1">
                <Label htmlFor="a-role">Role</Label>
                <Input id="a-role" value={form.role} onChange={(e) => set('role', e.target.value)} />
            </div>
            <div className="grid gap-1">
                <Label htmlFor="a-url">Job link</Label>
                <div className="flex gap-1">
                    <Input id="a-url" value={form.url} onChange={(e) => set('url', e.target.value)} />
                    {form.url && (
                        <Button asChild variant="ghost" size="icon" aria-label="Open job link">
                            <a href={hrefFor(form.url)} target="_blank" rel="noreferrer">
                                <ExternalLink />
                            </a>
                        </Button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                    <Label htmlFor="a-status">Status</Label>
                    <select
                        id="a-status"
                        className={selectCls}
                        value={form.status}
                        onChange={(e) => set('status', e.target.value as Status)}
                    >
                        {APPLICATION_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="grid gap-1">
                    <Label htmlFor="a-date">Applied on</Label>
                    <Input
                        id="a-date"
                        type="date"
                        value={form.appliedAt}
                        onChange={(e) => set('appliedAt', e.target.value)}
                    />
                </div>
            </div>
            <div className="grid gap-1">
                <Label htmlFor="a-cv">CV</Label>
                <select
                    id="a-cv"
                    className={selectCls}
                    value={form.variantId ?? ''}
                    onChange={(e) => {
                        const variantId = e.target.value || null
                        const latest = options.data?.exports.find((x) => x.variantId === variantId)
                        setForm({ ...form, variantId, exportId: latest?.id ?? null, letterId: null })
                    }}
                >
                    <option value="">—</option>
                    {options.data?.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                            {v.name}
                        </option>
                    ))}
                </select>
            </div>
            {form.variantId && (
                <div className="grid gap-1">
                    <Label htmlFor="a-export">File sent</Label>
                    <select
                        id="a-export"
                        className={selectCls}
                        value={form.exportId ?? ''}
                        onChange={(e) => set('exportId', e.target.value || null)}
                    >
                        <option value="">— none yet —</option>
                        {exports.map((x) => (
                            <option key={x.id} value={x.id}>
                                {x.format.toUpperCase()} · {new Date(x.createdAt).toLocaleString()}
                            </option>
                        ))}
                    </select>
                    {exports.length === 0 && (
                        <p className="text-muted-foreground text-xs">Export this CV first to link the exact file.</p>
                    )}
                </div>
            )}
            {form.variantId && letters.length > 0 && (
                <div className="grid gap-1">
                    <Label htmlFor="a-letter">Cover letter</Label>
                    <select
                        id="a-letter"
                        className={selectCls}
                        value={form.letterId ?? ''}
                        onChange={(e) => set('letterId', e.target.value || null)}
                    >
                        <option value="">—</option>
                        {letters.map((l) => (
                            <option key={l.id} value={l.id}>
                                {[l.company, l.role].filter(Boolean).join(' · ') || 'Untitled letter'}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            <div className="grid gap-1">
                <Label htmlFor="a-notes">Notes</Label>
                <Textarea id="a-notes" rows={5} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
            {(save.error ?? remove.error) && (
                <p className="text-destructive">{(save.error ?? remove.error)?.message}</p>
            )}
            <div className="flex items-center gap-2">
                <Button disabled={!form.company.trim() || save.isPending} onClick={() => save.mutate()}>
                    {form.id ? 'Save' : 'Add application'}
                </Button>
                {form.id && (
                    <Button
                        variant="ghost"
                        className="text-destructive ml-auto"
                        onClick={() => {
                            if (form.id && confirm(`Delete the application to ${form.company}?`)) remove.mutate(form.id)
                        }}
                    >
                        <Trash2 /> Delete
                    </Button>
                )}
            </div>
        </aside>
    )
}
