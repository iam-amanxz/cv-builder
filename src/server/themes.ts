import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { THEMES } from '#/themes'
import { themeTokensSchema } from '#/themes/types'

const { themePresets } = schema

export const listPresets = createServerFn({ method: 'GET' }).handler(async () => {
    return getDb().select().from(themePresets).orderBy(desc(themePresets.createdAt)).all()
})

export const savePreset = createServerFn({ method: 'POST' })
    .validator(
        z.object({
            name: z.string().trim().min(1).max(60),
            baseThemeId: z.string().refine((id) => id in THEMES, 'Unknown theme'),
            tokens: themeTokensSchema,
        }),
    )
    .handler(async ({ data }) => {
        const id = nanoid(10)
        getDb()
            .insert(themePresets)
            .values({ id, ...data })
            .run()
        return { id }
    })

export const deletePreset = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        getDb().delete(themePresets).where(eq(themePresets.id, data.id)).run()
        return { ok: true }
    })
