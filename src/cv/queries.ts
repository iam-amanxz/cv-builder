import { queryOptions } from '@tanstack/react-query'
import { listLetters } from '#/server/letters'
import { aiStatus, aiUsage } from '#/ai/tasks'
import { listPresets } from '#/server/themes'
import { listSnapshots } from '#/server/history'
import { getSnapshot } from '#/server/export'
import { getVariant, listExports, listVariants } from '#/server/variants'

export const variantsQuery = () => queryOptions({ queryKey: ['variants'], queryFn: () => listVariants() })

export const variantQuery = (id: string) =>
    queryOptions({
        queryKey: ['variant', id],
        queryFn: () => getVariant({ data: { id } }),
        // The editor owns the doc while open; don't clobber local edits.
        staleTime: Infinity,
        refetchOnWindowFocus: false,
    })

export const exportsQuery = (variantId: string) =>
    queryOptions({
        queryKey: ['exports', variantId],
        queryFn: () => listExports({ data: { variantId } }),
    })

export const snapshotsQuery = (variantId: string) =>
    queryOptions({
        queryKey: ['snapshots', variantId],
        queryFn: () => listSnapshots({ data: { variantId } }),
    })

/** Snapshots are immutable (apart from their label), so cache forever. */
export const snapshotQuery = (id: string) =>
    queryOptions({
        queryKey: ['snapshot', id],
        queryFn: () => getSnapshot({ data: { id } }),
        staleTime: Infinity,
    })

export const presetsQuery = () => queryOptions({ queryKey: ['presets'], queryFn: () => listPresets() })

export const aiStatusQuery = () =>
    queryOptions({ queryKey: ['ai-status'], queryFn: () => aiStatus(), staleTime: 60_000 })

export const aiUsageQuery = () => queryOptions({ queryKey: ['ai-usage'], queryFn: () => aiUsage() })

export const lettersQuery = (variantId: string) =>
    queryOptions({ queryKey: ['letters', variantId], queryFn: () => listLetters({ data: { variantId } }) })
