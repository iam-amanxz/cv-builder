import { queryOptions } from '@tanstack/react-query'
import { getVariant, listExports, listVariants } from '#/server/variants'

export const variantsQuery = () =>
  queryOptions({ queryKey: ['variants'], queryFn: () => listVariants() })

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
