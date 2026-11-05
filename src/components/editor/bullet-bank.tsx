import { useMemo, useState } from 'react'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { Library, Plus, X } from 'lucide-react'
import { bulletBank } from '#/server/bank'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

const bankQuery = () => queryOptions({ queryKey: ['bullet-bank'], queryFn: () => bulletBank(), staleTime: 30_000 })

/** Search past bullets and add one to this entry. */
export function BulletBankPicker({ current, onAdd }: { current: string[]; onAdd: (text: string) => void }) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    const bank = useQuery({ ...bankQuery(), enabled: open })
    const have = useMemo(() => new Set(current.map((c) => c.trim().toLowerCase())), [current])

    const results = useMemo(() => {
        const words = q.toLowerCase().split(/\s+/).filter(Boolean)
        return (bank.data ?? [])
            .filter((e) => !have.has(e.text.toLowerCase()))
            .filter((e) =>
                words.every((w) => e.text.toLowerCase().includes(w) || e.sources.join(' ').toLowerCase().includes(w)),
            )
            .slice(0, 40)
    }, [bank.data, q, have])

    if (!open) {
        return (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
                <Library /> From bullet bank
            </Button>
        )
    }
    return (
        <div className="col-span-2 space-y-2 rounded-md border bg-muted/40 p-2">
            <div className="flex items-center gap-2">
                <Input
                    autoFocus
                    className="h-8"
                    placeholder="Search bullets from all your CVs and versions…"
                    aria-label="Search bullet bank"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Close bullet bank"
                    onClick={() => setOpen(false)}
                >
                    <X />
                </Button>
            </div>
            {bank.isLoading && <p className="text-muted-foreground text-xs">Loading…</p>}
            {bank.data && results.length === 0 && (
                <p className="text-muted-foreground text-xs">{q ? 'No matches.' : 'No other bullets yet.'}</p>
            )}
            <ul className="max-h-72 space-y-1 overflow-y-auto">
                {results.map((e) => (
                    <li key={e.text} className="flex items-start gap-2 rounded bg-background p-2 text-sm">
                        <div className="min-w-0 flex-1">
                            <p>{e.text}</p>
                            <p className="text-muted-foreground truncate text-[11px]" title={e.sources.join('\n')}>
                                {e.sources[0]}
                                {e.sources.length > 1 ? ` +${e.sources.length - 1} more` : ''}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7"
                            aria-label={`Add: ${e.text}`}
                            onClick={() => onAdd(e.text)}
                        >
                            <Plus /> Add
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
