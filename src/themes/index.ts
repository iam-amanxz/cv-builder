import { centeredTheme } from './centered'
import { classicTheme } from './classic'
import { compactTheme } from './compact'
import { minimalTheme } from './minimal'
import { modernTheme } from './modern'
import { PAGE_SIZES } from './types'
import type { ThemeDef, ThemeOverrides, ThemeTokens } from './types'

export const THEMES: Record<string, ThemeDef> = {
    [centeredTheme.id]: centeredTheme,
    [classicTheme.id]: classicTheme,
    [modernTheme.id]: modernTheme,
    [minimalTheme.id]: minimalTheme,
    [compactTheme.id]: compactTheme,
}

export const DEFAULT_THEME_ID = centeredTheme.id

export function getTheme(id: string): ThemeDef {
    return THEMES[id] ?? centeredTheme
}

export function resolveTokens(themeId: string, overrides: ThemeOverrides): ThemeTokens {
    return { ...getTheme(themeId).defaults, ...overrides }
}

/** Overrides = tokens that differ from the theme's defaults. */
export function overridesFor(themeId: string, tokens: ThemeTokens): ThemeOverrides {
    const defaults = getTheme(themeId).defaults
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(tokens) as (keyof ThemeTokens)[]) {
        if (tokens[k] !== defaults[k]) out[k] = tokens[k]
    }
    return out
}

export function pageDims(tokens: ThemeTokens) {
    return PAGE_SIZES[tokens.pageSize]
}

export * from './types'
