import { queryOptions } from '@tanstack/react-query'
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
