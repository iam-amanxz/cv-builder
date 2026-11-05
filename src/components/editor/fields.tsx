import { useId } from 'react'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'

export type FieldType = 'text' | 'textarea' | 'lines' | 'csv'

/**
 * - text / textarea: plain string
 * - lines: string[] edited as one entry per line (bullets)
 * - csv:   string[] edited as comma-separated text (keywords)
 * Arrays round-trip exactly (no trimming while typing); themes trim on render.
 */
export function Field({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    wide,
}: {
    label: string
    type?: FieldType
    value: string | string[]
    onChange: (v: string | string[]) => void
    placeholder?: string
    wide?: boolean
}) {
    const id = useId()
    const text = Array.isArray(value) ? value.join(type === 'csv' ? ',' : '\n') : value
    const emit = (t: string) => {
        if (type === 'lines') onChange(t.split('\n'))
        else if (type === 'csv') onChange(t.split(','))
        else onChange(t)
    }
    const multi = type === 'textarea' || type === 'lines'
    return (
        <div className={cn('grid gap-1.5', (wide || multi) && 'col-span-2')}>
            <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
                {label}
                {type === 'lines' && <span className="opacity-70"> — one per line</span>}
                {type === 'csv' && <span className="opacity-70"> — comma separated</span>}
            </Label>
            {multi ? (
                <Textarea
                    id={id}
                    value={text}
                    placeholder={placeholder}
                    rows={type === 'lines' ? Math.max(3, text.split('\n').length + 1) : 4}
                    onChange={(e) => emit(e.target.value)}
                />
            ) : (
                <Input id={id} value={text} placeholder={placeholder} onChange={(e) => emit(e.target.value)} />
            )}
        </div>
    )
}
