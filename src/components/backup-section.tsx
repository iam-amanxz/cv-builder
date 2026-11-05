import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, Loader2, Upload } from 'lucide-react'
import { Button } from '#/components/ui/button'

/** Download a full backup, or restore one (keeps the current DB beside it). */
export function BackupSection() {
    const [file, setFile] = useState<File | null>(null)
    const restore = useMutation({
        mutationFn: async (f: File) => {
            const res = await fetch('/api/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/zip' },
                body: f,
            })
            const body = (await res.json()) as { error?: string; previous?: string; exportsAdded?: number }
            if (!res.ok) throw new Error(body.error ?? 'Restore failed')
            return body
        },
    })
    return (
        <section className="space-y-2">
            <h2 className="font-medium">Backup</h2>
            <div className="space-y-4 rounded-lg border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                    <Button asChild variant="outline">
                        <a href="/api/backup">
                            <Download /> Download backup (.zip)
                        </a>
                    </Button>
                    <span className="text-muted-foreground">
                        All CVs, versions, letters, applications and exported files.
                    </span>
                </div>
                <div className="space-y-2 border-t pt-4">
                    <label className="text-muted-foreground block" htmlFor="restore-file">
                        Restore from a backup. Your current data is kept as <code>cv.db.before-restore-…</code> in the
                        data folder.
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            id="restore-file"
                            type="file"
                            accept=".zip,application/zip"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                        <Button
                            variant="outline"
                            disabled={!file || restore.isPending}
                            onClick={() => {
                                if (file && confirm('Replace all current data with this backup?')) restore.mutate(file)
                            }}
                        >
                            {restore.isPending ? <Loader2 className="animate-spin" /> : <Upload />} Restore
                        </Button>
                    </div>
                    {restore.error && <p className="text-destructive">{restore.error.message}</p>}
                    {restore.data && (
                        <p className="text-emerald-800">
                            Restored. Previous database saved as <code>{restore.data.previous}</code>;{' '}
                            {restore.data.exportsAdded} exported files added.{' '}
                            <a className="underline" href="/">
                                Go to your CVs
                            </a>
                        </p>
                    )}
                </div>
            </div>
        </section>
    )
}
