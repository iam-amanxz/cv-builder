import { classicTheme } from './classic'
import { PAGE_SIZES } from './types'
import type { ThemeDef, ThemeOverrides, ThemeTokens } from './types'

export const THEMES: Record<string, ThemeDef> = {
    [classicTheme.id]: classicTheme,
}

export const DEFAULT_THEME_ID = classicTheme.id

export function getTheme(id: string): ThemeDef {
    return THEMES[id] ?? classicTheme
}

export function resolveTokens(themeId: string, overrides: ThemeOverrides): ThemeTokens {
    return { ...getTheme(themeId).defaults, ...overrides }
}

export function pageDims(tokens: ThemeTokens) {
    return PAGE_SIZES[tokens.pageSize]
}

export * from './types'
