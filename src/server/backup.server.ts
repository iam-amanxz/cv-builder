import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { DATA_DIR, DB_PATH, EXPORTS_DIR, closeDb, getDb } from '#/db'

/** Zip of a consistent DB copy (SQLite online backup) plus every exported file. */
export async function createBackup(): Promise<{ zip: Uint8Array; fileName: string }> {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cv-backup-')), 'cv.db')
    try {
        await getDb().$client.backup(tmp)
        const files: Record<string, Uint8Array> = { 'cv.db': fs.readFileSync(tmp) }
        for (const f of fs.readdirSync(EXPORTS_DIR)) {
            const full = path.join(EXPORTS_DIR, f)
            if (fs.statSync(full).isFile()) files[`exports/${f}`] = fs.readFileSync(full)
        }
        files['README.txt'] = strToU8(
            'CV Builder backup.\nRestore it from Settings → Backup, or stop the app and copy cv.db and exports/ into the data folder.\n',
        )
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
        return { zip: zipSync(files, { level: 6 }), fileName: `cv-builder-backup-${stamp}.zip` }
    } finally {
        fs.rmSync(path.dirname(tmp), { recursive: true, force: true })
    }
}

/**
 * Replace the database with the one in a backup zip and add its exported
 * files. The current database is kept next to it as cv.db.before-restore-*.
 */
export function restoreBackup(zipBytes: Uint8Array): { previous: string; exportsAdded: number } {
    let entries: Record<string, Uint8Array>
    try {
        entries = unzipSync(zipBytes)
    } catch {
        throw new Error('That file is not a valid zip.')
    }
    const dbBytes = entries['cv.db'] as Uint8Array | undefined
    if (!dbBytes || Buffer.from(dbBytes.subarray(0, 15)).toString() !== 'SQLite format 3') {
        throw new Error('No CV Builder database (cv.db) found in this zip.')
    }
    // Validate before touching anything.
    const probe = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cv-restore-')), 'cv.db')
    fs.writeFileSync(probe, dbBytes)
    try {
        const check = new Database(probe, { readonly: true })
        const ok = check.prepare("select 1 from sqlite_master where type='table' and name='variants'").get()
        check.close()
        if (!ok) throw new Error('The database in this zip is not a CV Builder database.')
    } finally {
        fs.rmSync(path.dirname(probe), { recursive: true, force: true })
    }

    closeDb()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const previous = `cv.db.before-restore-${stamp}`
    if (fs.existsSync(DB_PATH)) fs.renameSync(DB_PATH, path.join(DATA_DIR, previous))
    for (const ext of ['-wal', '-shm']) fs.rmSync(DB_PATH + ext, { force: true })
    fs.writeFileSync(DB_PATH, dbBytes)

    let exportsAdded = 0
    fs.mkdirSync(EXPORTS_DIR, { recursive: true })
    for (const [name, bytes] of Object.entries(entries)) {
        if (!name.startsWith('exports/') || name.endsWith('/')) continue
        const target = path.join(EXPORTS_DIR, path.basename(name))
        if (!fs.existsSync(target)) {
            fs.writeFileSync(target, bytes)
            exportsAdded++
        }
    }
    getDb() // reopen + run any newer migrations against the restored DB
    return { previous, exportsAdded }
}
