import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookmarkPlus, ChevronDown, ChevronUp, RotateCcw, Trash2 } from 'lucide-react'
import { presetsQuery } from '#/cv/queries'
import { deletePreset, savePreset } from '#/server/themes'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { FONT_STACKS, THEMES, getTheme, overridesFor } from '#/themes'
import type { ThemeOverrides, ThemeTokens } from '#/themes'

const selectCls =
    'h-8 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Control({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
    const id = useId()
    return (
        <div className="grid gap-1">
            <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
                {label}
            </Label>
            {children(id)}
        </div>
    )
}

function NumberSelect({
    id,
    value,
    options,
    unit,
    onChange,
}: {
    id: string
    value: number
    options: number[]
    unit: string
    onChange: (n: number) => void
}) {
    const opts = options.includes(value) ? options : [...options, value].sort((a, b) => a - b)
    return (
        <select id={id} className={selectCls} value={value} onChange={(e) => onChange(Number(e.target.value))}>
            {opts.map((n) => (
                <option key={n} value={n}>
                    {n}
                    {unit}
                </option>
            ))}
        </select>
    )
}

function ColorInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
    return (
        <input
            id={id}
            type="color"
            className="h-8 w-12 cursor-pointer rounded-md border bg-transparent p-0.5"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    )
}

function FontSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
    return (
        <select id={id} className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
            {Object.keys(FONT_STACKS).map((f) => (
                <option key={f} value={f} style={{ fontFamily: FONT_STACKS[f] }}>
                    {f}
                </option>
            ))}
        </select>
    )
}

/**
 * Theme picker + token editor. Changing the base theme keeps only the page
 * size override (fonts and colours belong to the theme); applying a saved
 * theme copies its tokens in.
 */
export function ThemePanel({
    themeId,
    tokens,
    overrides,
    onChange,
}: {
    themeId: string
    tokens: ThemeTokens
    overrides: ThemeOverrides
    onChange: (next: { themeId: string; overrides: ThemeOverrides }) => void
}) {
    const qc = useQueryClient()
    const presets = useQuery(presetsQuery())
    const [open, setOpen] = useState(false)

    const set = <TKey extends keyof ThemeTokens>(k: TKey, v: ThemeTokens[TKey]) =>
        onChange({ themeId, overrides: { ...overrides, [k]: v } })

    const pick = (value: string) => {
        if (value.startsWith('preset:')) {
            const p = presets.data?.find((x) => `preset:${x.id}` === value)
            if (p) onChange({ themeId: p.baseThemeId, overrides: overridesFor(p.baseThemeId, p.tokens) })
            return
        }
        const keep = overrides.pageSize ? { pageSize: overrides.pageSize } : {}
        onChange({ themeId: value, overrides: keep })
    }

    const save = useMutation({
        mutationFn: (name: string) => savePreset({ data: { name, baseThemeId: themeId, tokens } }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['presets'] }),
    })
    const remove = useMutation({
        mutationFn: (id: string) => deletePreset({ data: { id } }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['presets'] }),
    })

    // A saved theme is "selected" when the current tokens match it exactly.
    const matching = presets.data?.find(
        (p) => p.baseThemeId === themeId && JSON.stringify(p.tokens) === JSON.stringify(tokens),
    )

    return (
        <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-end gap-3">
                <Control label="Theme">
                    {(id) => (
                        <select
                            id={id}
                            className={selectCls}
                            value={matching ? `preset:${matching.id}` : themeId}
                            onChange={(e) => pick(e.target.value)}
                        >
                            <optgroup label="Built-in">
                                {Object.values(THEMES).map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                        {t.id === themeId && Object.keys(overrides).length && !matching
                                            ? ' (customised)'
                                            : ''}
                                    </option>
                                ))}
                            </optgroup>
                            {!!presets.data?.length && (
                                <optgroup label="My themes">
                                    {presets.data.map((p) => (
                                        <option key={p.id} value={`preset:${p.id}`}>
                                            {p.name} · {getTheme(p.baseThemeId).name}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    )}
                </Control>
                <Control label="Accent">
                    {(id) => <ColorInput id={id} value={tokens.accent} onChange={(v) => set('accent', v)} />}
                </Control>
                <Control label="Page">
                    {(id) => (
                        <select
                            id={id}
                            className={selectCls}
                            value={tokens.pageSize}
                            onChange={(e) => set('pageSize', e.target.value as ThemeTokens['pageSize'])}
                        >
                            <option value="A4">A4</option>
                            <option value="Letter">Letter</option>
                        </select>
                    )}
                </Control>
                <Control label="Text size">
                    {(id) => (
                        <NumberSelect
                            id={id}
                            value={tokens.fontSize}
                            options={[8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12]}
                            unit=" pt"
                            onChange={(n) => set('fontSize', n)}
                        />
                    )}
                </Control>
                <Control label="Margins">
                    {(id) => (
                        <NumberSelect
                            id={id}
                            value={tokens.marginMm}
                            options={[8, 10, 11, 12, 14, 16, 18, 20, 25]}
                            unit=" mm"
                            onChange={(n) => set('marginMm', n)}
                        />
                    )}
                </Control>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
                    {open ? <ChevronUp /> : <ChevronDown />} Customise
                </Button>
                {Object.keys(overrides).length > 0 && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange({ themeId, overrides: {} })}
                    >
                        <RotateCcw /> Reset
                    </Button>
                )}
            </div>

            {open && (
                <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                    <Control label="Body font">
                        {(id) => <FontSelect id={id} value={tokens.fontBody} onChange={(v) => set('fontBody', v)} />}
                    </Control>
                    <Control label="Heading font">
                        {(id) => (
                            <FontSelect id={id} value={tokens.fontHeading} onChange={(v) => set('fontHeading', v)} />
                        )}
                    </Control>
                    <Control label="Text">
                        {(id) => <ColorInput id={id} value={tokens.text} onChange={(v) => set('text', v)} />}
                    </Control>
                    <Control label="Muted">
                        {(id) => <ColorInput id={id} value={tokens.muted} onChange={(v) => set('muted', v)} />}
                    </Control>
                    <Control label="Line height">
                        {(id) => (
                            <NumberSelect
                                id={id}
                                value={tokens.lineHeight}
                                options={[1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.6]}
                                unit=""
                                onChange={(n) => set('lineHeight', n)}
                            />
                        )}
                    </Control>
                    <Control label="Section spacing">
                        {(id) => (
                            <NumberSelect
                                id={id}
                                value={tokens.sectionGap}
                                options={[0.6, 0.75, 0.9, 1, 1.1, 1.2, 1.4, 1.6, 2]}
                                unit=" em"
                                onChange={(n) => set('sectionGap', n)}
                            />
                        )}
                    </Control>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={save.isPending}
                        onClick={() => {
                            const name = prompt('Name for this theme', `My ${getTheme(themeId).name}`)
                            if (name?.trim()) save.mutate(name.trim())
                        }}
                    >
                        <BookmarkPlus /> Save as my theme
                    </Button>
                    {matching && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={remove.isPending}
                            onClick={() => {
                                if (confirm(`Delete saved theme "${matching.name}"? CVs using it keep their look.`))
                                    remove.mutate(matching.id)
                            }}
                        >
                            <Trash2 /> Delete “{matching.name}”
                        </Button>
                    )}
                    {(save.error ?? remove.error) && (
                        <span className="text-destructive text-xs">{(save.error ?? remove.error)?.message}</span>
                    )}
                </div>
            )}
        </div>
    )
}
