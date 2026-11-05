import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Briefcase, Copy, FileText, FileUp, Plus, Settings, Star, Trash2 } from 'lucide-react'
import { variantsQuery } from '#/cv/queries'
import { archiveVariant, createVariant } from '#/server/variants'
import { forkVariant } from '#/server/history'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { getTheme } from '#/themes'
import { LocalTime } from '#/components/local-time'

export const Route = createFileRoute('/')({
    loader: ({ context }) => context.queryClient.ensureQueryData(variantsQuery()),
    component: Dashboard,
})

function Dashboard() {
    const { data: variants } = useSuspenseQuery(variantsQuery())
    const qc = useQueryClient()
    const navigate = useNavigate()
    const [name, setName] = useState('')

    const create = useMutation({
        mutationFn: (start: 'empty' | 'sample') =>
            createVariant({ data: { name: name.trim() || 'Untitled CV', start } }),
        onSuccess: async ({ id }) => {
            await qc.invalidateQueries({ queryKey: ['variants'] })
            navigate({ to: '/cv/$variantId', params: { variantId: id } })
        },
    })

    const duplicate = useMutation({
        mutationFn: (v: { variantId: string; name: string }) => forkVariant({ data: v }),
        onSuccess: async ({ id }) => {
            await qc.invalidateQueries({ queryKey: ['variants'] })
            navigate({ to: '/cv/$variantId', params: { variantId: id } })
        },
    })
    const nameOf = new Map(variants.map((v) => [v.id, v.name]))

    const archive = useMutation({
        mutationFn: (id: string) => archiveVariant({ data: { id } }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['variants'] }),
    })

    return (
        <main className="mx-auto max-w-4xl px-4 py-10">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold tracking-tight">Your CVs</h1>
                <Button asChild variant="ghost" size="sm" className="ml-auto">
                    <Link to="/applications">
                        <Briefcase /> Applications
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link to="/import">
                        <FileUp /> Import
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link to="/settings">
                        <Settings /> Settings
                    </Link>
                </Button>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
                Each CV is an editable variant. Every export is saved as a frozen version.
            </p>

            <form
                className="mt-6 flex flex-wrap gap-2"
                onSubmit={(e) => {
                    e.preventDefault()
                    create.mutate('empty')
                }}
            >
                <Input
                    className="max-w-xs"
                    placeholder="New CV name, e.g. Backend roles"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <Button type="submit" disabled={create.isPending}>
                    <Plus /> New blank
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={create.isPending}
                    onClick={() => create.mutate('sample')}
                >
                    New from sample
                </Button>
            </form>

            <ul className="mt-8 divide-y rounded-lg border bg-card">
                {variants.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                        <FileText className="text-muted-foreground size-5 shrink-0" />
                        <Link
                            to="/cv/$variantId"
                            params={{ variantId: v.id }}
                            className="min-w-0 flex-1 hover:underline"
                        >
                            <span className="font-medium">{v.name}</span>
                            {v.isMaster && (
                                <span className="text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs">
                                    <Star className="size-3" /> master
                                </span>
                            )}
                            {v.parentId && nameOf.has(v.parentId) && (
                                <span className="text-muted-foreground ml-2 text-xs">
                                    from {nameOf.get(v.parentId)}
                                </span>
                            )}
                        </Link>
                        <span className="text-muted-foreground hidden text-xs sm:inline">
                            {getTheme(v.themeId).name} · edited <LocalTime value={v.updatedAt} />
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Duplicate ${v.name}`}
                            title="Duplicate"
                            disabled={duplicate.isPending}
                            onClick={() => {
                                const n = prompt('Name for the copy', `${v.name} (copy)`)
                                if (n?.trim()) duplicate.mutate({ variantId: v.id, name: n.trim() })
                            }}
                        >
                            <Copy />
                        </Button>
                        {!v.isMaster && (
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Archive ${v.name}`}
                                onClick={() => {
                                    if (confirm(`Archive "${v.name}"? Its exports are kept.`)) archive.mutate(v.id)
                                }}
                            >
                                <Trash2 />
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
        </main>
    )
}
