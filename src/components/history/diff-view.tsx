import { cn } from '#/lib/utils'
import type { CvDiff, FieldChange, ItemChange, ListChange } from '#/cv/diff'

function Field({ c }: { c: FieldChange }) {
    return (
        <div className="grid gap-0.5 text-sm">
            <div className="text-muted-foreground text-xs">{c.label}</div>
            {c.before && (
                <div className="rounded bg-bad-wash px-2 py-1 whitespace-pre-line text-bad-ink line-through decoration-bad/60">
                    {c.before}
                </div>
            )}
            {c.after && <div className="rounded bg-win-wash px-2 py-1 whitespace-pre-line text-win-ink">{c.after}</div>}
            {!c.after && <div className="text-muted-foreground px-2 text-xs italic">removed</div>}
        </div>
    )
}

function Lines({ l }: { l: ListChange }) {
    return (
        <div className="grid gap-0.5 text-sm">
            <div className="text-muted-foreground text-xs">{l.label}</div>
            <ul className="overflow-hidden rounded border">
                {l.lines.map((line, i) => (
                    <li
                        key={i}
                        className={cn(
                            'flex gap-2 px-2 py-0.5',
                            line.op === 'add' && 'bg-win-wash text-win-ink',
                            line.op === 'del' && 'bg-bad-wash text-bad-ink line-through decoration-bad/60',
                            line.op === 'same' && 'text-muted-foreground',
                        )}
                    >
                        <span className="w-3 shrink-0 font-mono select-none">
                            {line.op === 'add' ? '+' : line.op === 'del' ? '−' : ' '}
                        </span>
                        <span>{line.text}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

const BADGE = {
    added: 'bg-win-wash text-win-ink',
    removed: 'bg-bad-wash text-bad-ink',
    changed: 'bg-warn-wash text-warn-ink',
}

function Badge({ kind }: { kind: keyof typeof BADGE }) {
    return <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', BADGE[kind])}>{kind}</span>
}

function Item({ c }: { c: ItemChange }) {
    return (
        <div className="space-y-2 rounded-lg border-2 bg-card p-3">
            <div className="flex items-center gap-2">
                <Badge kind={c.kind} />
                <span className="font-medium">{c.title}</span>
                {c.kind === 'changed' && c.visibility && (
                    <span className="text-muted-foreground text-xs">
                        {c.visibility === 'hidden' ? 'hidden from CV' : 'shown on CV'}
                    </span>
                )}
            </div>
            {c.kind === 'changed' && (
                <>
                    {c.fields.map((f) => (
                        <Field key={f.label} c={f} />
                    ))}
                    {c.lists.map((l) => (
                        <Lines key={l.label} l={l} />
                    ))}
                </>
            )}
        </div>
    )
}

function Group({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {children}
        </section>
    )
}

export function DiffView({ diff }: { diff: CvDiff }) {
    if (diff.count === 0) {
        return (
            <p className="text-muted-foreground py-10 text-center text-sm">
                No differences. These two versions are identical.
            </p>
        )
    }
    return (
        <div className="space-y-6">
            <p className="text-muted-foreground text-sm">
                {diff.count} change{diff.count === 1 ? '' : 's'}
            </p>
            {diff.basics.length > 0 && (
                <Group title="Personal details">
                    <div className="space-y-2 rounded-lg border-2 bg-card p-3">
                        {diff.basics.map((c) => (
                            <Field key={c.label} c={c} />
                        ))}
                    </div>
                </Group>
            )}
            {diff.sections.map((s) => (
                <Group
                    key={s.key}
                    title={
                        <span className="flex items-center gap-2">
                            {s.title}
                            {s.status !== 'changed' && <Badge kind={s.status} />}
                            {s.reordered && (
                                <span className="text-muted-foreground text-xs font-normal">items reordered</span>
                            )}
                        </span>
                    }
                >
                    {s.fields.length > 0 && (
                        <div className="space-y-2 rounded-lg border-2 bg-card p-3">
                            {s.fields.map((c) => (
                                <Field key={c.label} c={c} />
                            ))}
                        </div>
                    )}
                    {s.items.map((c) => (
                        <Item key={c.id} c={c} />
                    ))}
                </Group>
            ))}
            {diff.layout.length > 0 && (
                <Group title="Layout">
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                        {diff.layout.map((l) => (
                            <li key={l}>{l}</li>
                        ))}
                    </ul>
                </Group>
            )}
            {diff.theme.length > 0 && (
                <Group title="Theme">
                    <div className="space-y-2 rounded-lg border-2 bg-card p-3">
                        {diff.theme.map((c) => (
                            <Field key={c.label} c={c} />
                        ))}
                    </div>
                </Group>
            )}
        </div>
    )
}
