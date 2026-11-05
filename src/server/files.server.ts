import path from 'node:path'
import { eq } from 'drizzle-orm'
import { EXPORTS_DIR, getDb, schema } from '#/db'

/** Look up an exported file. Server-only: used by the download route. */
export function readExport(id: string) {
  const { exportsTable } = schema
  const row = getDb().select().from(exportsTable).where(eq(exportsTable.id, id)).get()
  if (!row) return null
  return { row, filePath: path.join(EXPORTS_DIR, path.basename(row.fileName)) }
}
