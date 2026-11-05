import { RotateCcw } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { getTheme } from '#/themes'
import type { ThemeOverrides, ThemeTokens } from '#/themes'

const selectCls =
  'h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** Quick theme controls. The full token editor arrives in phase 3. */
export function ThemePanel({
  themeId,
  tokens,
  overrides,
  onChange,
}: {
  themeId: string
  tokens: ThemeTokens
  overrides: ThemeOverrides
  onChange: (o: ThemeOverrides) => void
}) {
  const set = <TKey extends keyof ThemeTokens>(k: TKey, v: ThemeTokens[TKey]) =>
    onChange({ ...overrides, [k]: v })

  return (
    <div className="flex flex-wrap items-end gap-4 text-sm">
      <div className="grid gap-1">
        <Label className="text-muted-foreground text-xs font-normal">Theme</Label>
        <div className="h-8 leading-8 font-medium">{getTheme(themeId).name}</div>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="accent" className="text-muted-foreground text-xs font-normal">
          Accent
        </Label>
        <input
          id="accent"
          type="color"
          className="h-8 w-12 cursor-pointer rounded-md border bg-transparent p-0.5"
          value={tokens.accent}
          onChange={(e) => set('accent', e.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="page" className="text-muted-foreground text-xs font-normal">
          Page
        </Label>
        <select
          id="page"
          className={selectCls}
          value={tokens.pageSize}
          onChange={(e) => set('pageSize', e.target.value as ThemeTokens['pageSize'])}
        >
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="size" className="text-muted-foreground text-xs font-normal">
          Text size
        </Label>
        <select
          id="size"
          className={selectCls}
          value={tokens.fontSize}
          onChange={(e) => set('fontSize', Number(e.target.value))}
        >
          {[8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12].map((n) => (
            <option key={n} value={n}>
              {n} pt
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="margin" className="text-muted-foreground text-xs font-normal">
          Margins
        </Label>
        <select
          id="margin"
          className={selectCls}
          value={tokens.marginMm}
          onChange={(e) => set('marginMm', Number(e.target.value))}
        >
          {[10, 12, 14, 16, 18, 20, 25].map((n) => (
            <option key={n} value={n}>
              {n} mm
            </option>
          ))}
        </select>
      </div>
      {Object.keys(overrides).length > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}>
          <RotateCcw /> Reset
        </Button>
      )}
    </div>
  )
}
