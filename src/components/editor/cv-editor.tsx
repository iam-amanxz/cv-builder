import { useState } from 'react'
import { nanoid } from 'nanoid'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { resolvedSectionOrder, sectionTitle } from '#/cv/schema'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'
import { Field } from './fields'
import { BulletCoach, SummaryHelper } from '#/components/ai/inline-helpers'
import { defFor, itemsOf } from './section-config'
import type { CvDoc } from '#/cv/schema'
import type { AnyItem } from './section-config'

/** Sections whose items have bullet highlights worth coaching. */
const COACHED = new Set(['work', 'projects', 'education'])
const str = (v: unknown) => (typeof v === 'string' ? v : '')

export type Mutate = (fn: (draft: CvDoc) => void) => void

function move<T>(arr: T[], from: number, to: number) {
    if (to < 0 || to >= arr.length) return
    const [x] = arr.splice(from, 1)
    arr.splice(to, 0, x)
}

function IconBtn({
    label,
    onClick,
    children,
    disabled,
}: {
    label: string
    onClick: () => void
    children: React.ReactNode
    disabled?: boolean
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation()
                onClick()
            }}
        >
            {children}
        </Button>
    )
}

export function CvEditor({ doc, mutate }: { doc: CvDoc; mutate: Mutate }) {
    const order = resolvedSectionOrder(doc)
    return (
        <div className="space-y-3">
            <BasicsCard doc={doc} mutate={mutate} />
            {order.map((key, idx) => (
                <SectionCard
                    key={key}
                    doc={doc}
                    sectionKey={key}
                    mutate={mutate}
                    isFirst={idx === 0}
                    isLast={idx === order.length - 1}
                    onMove={(dir) =>
                        mutate((d) => {
                            const o = resolvedSectionOrder(d)
                            move(o, idx, idx + dir)
                            d.meta.sectionOrder = o
                        })
                    }
                />
            ))}
            <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                    mutate((d) => {
                        const id = nanoid(8)
                        d.custom.push({ id, title: 'New section', items: [] })
                        d.meta.sectionOrder = [...resolvedSectionOrder(d)]
                    })
                }
            >
                <Plus /> Add custom section
            </Button>
        </div>
    )
}

function Card({
    title,
    right,
    children,
    defaultOpen = false,
    muted,
}: {
    title: React.ReactNode
    right?: React.ReactNode
    children: React.ReactNode
    defaultOpen?: boolean
    muted?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className={cn('rounded-lg border bg-card', muted && 'opacity-60')}>
            <div className="flex cursor-pointer items-center gap-2 px-3 py-2" onClick={() => setOpen((o) => !o)}>
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                <div className="min-w-0 flex-1 truncate font-medium">{title}</div>
                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    {right}
                </div>
            </div>
            {open && <div className="border-t px-3 py-3">{children}</div>}
        </div>
    )
}

function BasicsCard({ doc, mutate }: { doc: CvDoc; mutate: Mutate }) {
    const b = doc.basics
    const set = (k: keyof typeof b) => (v: string | string[]) =>
        mutate((d) => {
            ;(d.basics as Record<string, unknown>)[k] = v
        })
    return (
        <Card title="Personal details" defaultOpen>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Full name" value={b.name} onChange={set('name')} />
                <Field
                    label="Headline"
                    value={b.label}
                    onChange={set('label')}
                    placeholder="Senior Software Engineer"
                />
                <Field label="Email" value={b.email} onChange={set('email')} />
                <Field label="Phone" value={b.phone} onChange={set('phone')} />
                <Field label="Location" value={b.location} onChange={set('location')} />
                <Field label="Website" value={b.url} onChange={set('url')} />
                <div className="col-span-2 space-y-2">
                    <div className="text-muted-foreground text-xs">Profiles</div>
                    {b.profiles.map((p, i) => (
                        <div key={p.id} className="flex gap-2">
                            <Input
                                className="w-32"
                                placeholder="Network"
                                value={p.network}
                                onChange={(e) =>
                                    mutate((d) => {
                                        d.basics.profiles[i].network = e.target.value
                                    })
                                }
                            />
                            <Input
                                placeholder="URL"
                                value={p.url}
                                onChange={(e) =>
                                    mutate((d) => {
                                        d.basics.profiles[i].url = e.target.value
                                    })
                                }
                            />
                            <IconBtn
                                label="Remove profile"
                                onClick={() =>
                                    mutate((d) => {
                                        d.basics.profiles.splice(i, 1)
                                    })
                                }
                            >
                                <Trash2 />
                            </IconBtn>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            mutate((d) => {
                                d.basics.profiles.push({ id: nanoid(8), network: '', username: '', url: '' })
                            })
                        }
                    >
                        <Plus /> Add profile
                    </Button>
                </div>
            </div>
        </Card>
    )
}

function SectionCard({
    doc,
    sectionKey,
    mutate,
    isFirst,
    isLast,
    onMove,
}: {
    doc: CvDoc
    sectionKey: string
    mutate: Mutate
    isFirst: boolean
    isLast: boolean
    onMove: (dir: -1 | 1) => void
}) {
    const hidden = doc.meta.hiddenSections.includes(sectionKey)
    const title = sectionTitle(doc, sectionKey)
    const isCustom = sectionKey.startsWith('custom:')

    const toggleHidden = () =>
        mutate((d) => {
            const set = new Set(d.meta.hiddenSections)
            if (set.has(sectionKey)) set.delete(sectionKey)
            else set.add(sectionKey)
            d.meta.hiddenSections = [...set]
        })

    const rename = (value: string) =>
        mutate((d) => {
            if (isCustom) {
                const c = d.custom.find((x) => `custom:${x.id}` === sectionKey)
                if (c) c.title = value
            } else {
                d.meta.sectionTitles[sectionKey] = value
            }
        })

    return (
        <Card
            muted={hidden}
            title={title}
            right={
                <>
                    <IconBtn label="Move section up" disabled={isFirst} onClick={() => onMove(-1)}>
                        <ArrowUp />
                    </IconBtn>
                    <IconBtn label="Move section down" disabled={isLast} onClick={() => onMove(1)}>
                        <ArrowDown />
                    </IconBtn>
                    <IconBtn label={hidden ? 'Show section' : 'Hide section'} onClick={toggleHidden}>
                        {hidden ? <EyeOff /> : <Eye />}
                    </IconBtn>
                    {isCustom && (
                        <IconBtn
                            label="Delete section"
                            onClick={() => {
                                if (!confirm(`Delete section "${title}"?`)) return
                                mutate((d) => {
                                    d.custom = d.custom.filter((c) => `custom:${c.id}` !== sectionKey)
                                    d.meta.sectionOrder = d.meta.sectionOrder.filter((k) => k !== sectionKey)
                                })
                            }}
                        >
                            <Trash2 />
                        </IconBtn>
                    )}
                </>
            }
        >
            <div className="mb-3 grid grid-cols-2 gap-3">
                <Field label="Section heading" value={title} onChange={(v) => rename(v as string)} wide />
            </div>
            {sectionKey === 'summary' ? (
                <div className="grid grid-cols-2">
                    <Field
                        label="Professional summary"
                        type="textarea"
                        value={doc.basics.summary}
                        onChange={(v) =>
                            mutate((d) => {
                                d.basics.summary = v as string
                            })
                        }
                    />
                    <SummaryHelper
                        doc={doc}
                        onApply={(text) =>
                            mutate((d) => {
                                d.basics.summary = text
                            })
                        }
                    />
                </div>
            ) : (
                <ItemList doc={doc} sectionKey={sectionKey} mutate={mutate} />
            )}
        </Card>
    )
}

function ItemList({ doc, sectionKey, mutate }: { doc: CvDoc; sectionKey: string; mutate: Mutate }) {
    const def = defFor(sectionKey)
    const items = itemsOf(doc, sectionKey)
    if (!def || !items) return null

    const edit = (fn: (arr: AnyItem[]) => void) =>
        mutate((d) => {
            const arr = itemsOf(d, sectionKey)
            if (arr) fn(arr)
        })

    return (
        <div className="space-y-2">
            {items.map((item, i) => (
                <Card
                    key={item.id}
                    muted={item.hidden}
                    title={<span className="text-sm">{def.summary(item)}</span>}
                    right={
                        <>
                            <IconBtn label="Move up" disabled={i === 0} onClick={() => edit((a) => move(a, i, i - 1))}>
                                <ArrowUp />
                            </IconBtn>
                            <IconBtn
                                label="Move down"
                                disabled={i === items.length - 1}
                                onClick={() => edit((a) => move(a, i, i + 1))}
                            >
                                <ArrowDown />
                            </IconBtn>
                            <IconBtn
                                label={item.hidden ? 'Show on CV' : 'Hide from CV'}
                                onClick={() =>
                                    edit((a) => {
                                        a[i].hidden = !a[i].hidden
                                    })
                                }
                            >
                                {item.hidden ? <EyeOff /> : <Eye />}
                            </IconBtn>
                            <IconBtn
                                label="Delete"
                                onClick={() => {
                                    if (confirm(`Delete "${def.summary(item)}"?`)) edit((a) => a.splice(i, 1))
                                }}
                            >
                                <Trash2 />
                            </IconBtn>
                        </>
                    }
                >
                    <div className="grid grid-cols-2 gap-3">
                        {def.fields.map((f) => (
                            <Field
                                key={f.key}
                                label={f.label}
                                type={f.type}
                                wide={f.wide}
                                placeholder={f.placeholder}
                                value={(item[f.key] as string | string[] | undefined) ?? ''}
                                onChange={(v) =>
                                    edit((a) => {
                                        a[i][f.key] = v
                                    })
                                }
                            />
                        ))}
                        {COACHED.has(sectionKey) && (
                            <BulletCoach
                                role={str(item.position) || str(item.studyType) || str(item.name)}
                                organisation={str(item.name) || str(item.institution)}
                                highlights={(item.highlights as string[] | undefined) ?? []}
                                onApply={(next) =>
                                    edit((a) => {
                                        a[i].highlights = next
                                    })
                                }
                            />
                        )}
                    </div>
                </Card>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => edit((a) => a.push(def.create()))}>
                <Plus /> {def.addLabel}
            </Button>
        </div>
    )
}
