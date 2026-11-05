import type { ThemeOverrides, ThemeTokens } from '#/themes'

/**
 * One small tightening step, in order of least visible change first:
 * section spacing → line height → margins → text size. Returns the next
 * overrides, or null when every lever is at its floor.
 */
export function tightenStep(tokens: ThemeTokens, overrides: ThemeOverrides): ThemeOverrides | null {
    const r = (n: number) => Math.round(n * 100) / 100
    if (tokens.sectionGap > 0.6) return { ...overrides, sectionGap: r(Math.max(0.6, tokens.sectionGap - 0.1)) }
    if (tokens.lineHeight > 1.2) return { ...overrides, lineHeight: r(Math.max(1.2, tokens.lineHeight - 0.05)) }
    if (tokens.marginMm > 10) return { ...overrides, marginMm: Math.max(10, tokens.marginMm - 2) }
    if (tokens.fontSize > 8.5) return { ...overrides, fontSize: r(Math.max(8.5, tokens.fontSize - 0.5)) }
    return null
}
