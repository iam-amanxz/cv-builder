import { z } from 'zod'
import type { CvDoc } from '#/cv/schema'

export const PAGE_SIZES = {
  A4: { widthMm: 210, heightMm: 297 },
  Letter: { widthMm: 215.9, heightMm: 279.4 },
} as const

export const themeTokensSchema = z.object({
  fontBody: z.string(),
  fontHeading: z.string(),
  /** Base font size in pt. */
  fontSize: z.number().min(7).max(14),
  lineHeight: z.number().min(1).max(2),
  accent: z.string(),
  text: z.string(),
  muted: z.string(),
  pageSize: z.enum(['A4', 'Letter']),
  /** Page margin in mm (all sides). */
  marginMm: z.number().min(5).max(30),
  /** Gap between sections in em. */
  sectionGap: z.number().min(0.4).max(3),
})

export type ThemeTokens = z.infer<typeof themeTokensSchema>
export const themeOverridesSchema = themeTokensSchema.partial()
export type ThemeOverrides = z.infer<typeof themeOverridesSchema>

export interface ThemeProps {
  doc: CvDoc
  tokens: ThemeTokens
}

export interface ThemeDef {
  id: string
  name: string
  description: string
  defaults: ThemeTokens
  Component: React.ComponentType<ThemeProps>
}

export const FONT_STACKS: Record<string, string> = {
  Inter: "'Inter Variable', 'Inter', system-ui, sans-serif",
  'Source Serif': "'Source Serif 4', Georgia, serif",
}

export function fontStack(name: string): string {
  return FONT_STACKS[name] ?? name
}
