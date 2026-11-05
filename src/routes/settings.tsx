import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, CircleAlert } from 'lucide-react'
import { aiStatusQuery, aiUsageQuery } from '#/cv/queries'
import { Button } from '#/components/ui/button'
import { LocalTime } from '#/components/local-time'
import { BackupSection } from '#/components/backup-section'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/settings')({
    loader: ({ context }) => context.queryClient.ensureQueryData(aiStatusQuery()),
    head: () => ({ meta: [{ title: 'Settings · CV Builder' }] }),
    component: SettingsPage,
})

const usd = (n: number | null | undefined) =>
    n == null ? '—' : n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(n < 1 ? 3 : 2)}`

function SettingsPage() {
    const { data: status } = useSuspenseQuery(aiStatusQuery())
    const usage = useQuery(aiUsageQuery())

    return (
        <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon" aria-label="Back to all CVs">
                    <Link to="/">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            </div>

            <section className="space-y-2">
                <h2 className="font-medium">AI</h2>
                <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm">
                    {status.configured ? (
                        <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
                    ) : (
                        <CircleAlert className="mt-0.5 size-5 text-amber-600" />
                    )}
                    <div className="space-y-1">
                        <p className="font-medium">{status.configured ? 'Connected' : 'Not configured'}</p>
                        <p className="text-muted-foreground">
                            Model <code>{status.model}</code> (set <code>AI_MODEL</code> in <code>.env</code> to
                            change).
                            {!status.configured && (
                                <>
                                    {' '}
                                    Add <code>ANTHROPIC_API_KEY</code> to <code>.env</code>, then{' '}
                                    <code>docker compose up -d</code>.
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </section>

            <BackupSection />

            <section className="space-y-3">
                <h2 className="font-medium">AI usage</h2>
                {usage.data ? (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {(
                                [
                                    ['This month', usage.data.month],
                                    ['All time', usage.data.allTime],
                                ] as const
                            ).map(([label, t]) => (
                                <div key={label} className="rounded-lg border bg-card p-4">
                                    <div className="text-muted-foreground text-xs">{label}</div>
                                    <div className="mt-1 text-2xl font-semibold tabular-nums">{usd(t?.cost ?? 0)}</div>
                                    <div className="text-muted-foreground mt-1 text-xs tabular-nums">
                                        {t?.runs ?? 0} calls · {(t?.inputTokens ?? 0).toLocaleString()} in /{' '}
                                        {(t?.outputTokens ?? 0).toLocaleString()} out tokens
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-muted-foreground text-xs">
                            Estimated from token counts at list prices; your Anthropic console is the source of truth.
                        </p>
                        {usage.data.recent.length > 0 && (
                            <div className="overflow-x-auto rounded-lg border bg-card">
                                <table className="w-full text-sm">
                                    <thead className="text-muted-foreground border-b text-left text-xs">
                                        <tr>
                                            <th className="px-3 py-2 font-normal">When</th>
                                            <th className="px-3 py-2 font-normal">Task</th>
                                            <th className="px-3 py-2 font-normal">Status</th>
                                            <th className="px-3 py-2 text-right font-normal">Tokens</th>
                                            <th className="px-3 py-2 text-right font-normal">Cost</th>
                                            <th className="px-3 py-2 text-right font-normal">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {usage.data.recent.map((r) => (
                                            <tr key={r.id} title={r.error ?? undefined}>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <LocalTime value={r.createdAt} />
                                                </td>
                                                <td className="px-3 py-2">{r.kind}</td>
                                                <td
                                                    className={cn(
                                                        'px-3 py-2',
                                                        r.status === 'ok' ? 'text-emerald-700' : 'text-rose-700',
                                                    )}
                                                >
                                                    {r.status}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {(r.inputTokens + r.outputTokens).toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">{usd(r.costUsd)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {(r.durationMs / 1000).toFixed(1)}s
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-muted-foreground text-sm">Loading…</p>
                )}
            </section>
        </main>
    )
}
