import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? 'data')
export const EXPORTS_DIR = path.join(DATA_DIR, 'exports')

function open() {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true })
    const sqlite = new Database(path.join(DATA_DIR, 'cv.db'))
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    const db = drizzle(sqlite, { schema })
    migrate(db, {
        migrationsFolder: path.resolve(process.env.MIGRATIONS_DIR ?? 'drizzle'),
    })
    return db
}

type Db = ReturnType<typeof open>

// Survive Vite HMR in dev: keep one connection per process.
const g = globalThis as unknown as { __cvDb?: Db }

export function getDb(): Db {
    g.__cvDb ??= open()
    return g.__cvDb
}

export const DB_PATH = path.join(DATA_DIR, 'cv.db')

/** Checkpoint and close the connection (used by restore); the next getDb() reopens. */
export function closeDb(): void {
    const db = g.__cvDb
    if (!db) return
    db.$client.pragma('wal_checkpoint(TRUNCATE)')
    db.$client.close()
    g.__cvDb = undefined
}

export { schema }
