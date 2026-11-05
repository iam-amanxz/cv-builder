import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getDb, schema } from '#/db'
import { APPLICATION_STATUSES } from '#/cv/applications'

const { applications, variants, exportsTable, snapshots, coverLetters } = schema

export const listApplications = createServerFn({ method: 'GET' }).handler(async () => {
    return getDb()
        .select({
            app: applications,
            variantName: variants.name,
            exportFile: exportsTable.fileName,
            exportFormat: exportsTable.format,
            snapshotId: exportsTable.snapshotId,
            letterCompany: coverLetters.company,
        })
        .from(applications)
        .leftJoin(variants, eq(variants.id, applications.variantId))
        .leftJoin(exportsTable, eq(exportsTable.id, applications.exportId))
        .leftJoin(coverLetters, eq(coverLetters.id, applications.letterId))
        .orderBy(desc(applications.updatedAt))
        .all()
})

/** Everything the form needs to link an application to what was sent. */
export const applicationOptions = createServerFn({ method: 'GET' }).handler(async () => {
    const db = getDb()
    const vs = db
        .select({ id: variants.id, name: variants.name })
        .from(variants)
        .where(eq(variants.archived, false))
        .orderBy(desc(variants.updatedAt))
        .all()
    const exps = db
        .select({
            id: exportsTable.id,
            variantId: snapshots.variantId,
            fileName: exportsTable.fileName,
            format: exportsTable.format,
            createdAt: exportsTable.createdAt,
        })
        .from(exportsTable)
        .innerJoin(snapshots, eq(snapshots.id, exportsTable.snapshotId))
        .orderBy(desc(exportsTable.createdAt))
        .all()
    const letters = db
        .select({
            id: coverLetters.id,
            variantId: coverLetters.variantId,
            company: coverLetters.company,
            role: coverLetters.role,
        })
        .from(coverLetters)
        .orderBy(desc(coverLetters.updatedAt))
        .all()
    return { variants: vs, exports: exps, letters }
})

const fields = z.object({
    company: z.string().trim().min(1).max(200),
    role: z.string().max(200),
    url: z.string().max(1000),
    variantId: z.string().nullable(),
    exportId: z.string().nullable(),
    letterId: z.string().nullable(),
    status: z.enum(APPLICATION_STATUSES),
    appliedAt: z.string().max(20),
    notes: z.string().max(10000),
})

export const createApplication = createServerFn({ method: 'POST' })
    .validator(fields)
    .handler(async ({ data }) => {
        const id = nanoid(10)
        getDb()
            .insert(applications)
            .values({ ...data, id, updatedAt: new Date() })
            .run()
        return { id }
    })

export const updateApplication = createServerFn({ method: 'POST' })
    .validator(fields.partial().extend({ id: z.string() }))
    .handler(async ({ data }) => {
        const { id, ...patch } = data
        getDb()
            .update(applications)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(applications.id, id))
            .run()
        return { ok: true }
    })

export const deleteApplication = createServerFn({ method: 'POST' })
    .validator(z.object({ id: z.string() }))
    .handler(async ({ data }) => {
        getDb().delete(applications).where(eq(applications.id, data.id)).run()
        return { ok: true }
    })
