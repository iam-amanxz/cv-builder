import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, FileUp, Loader2, Sparkles } from 'lucide-react'
import { aiStatusQuery } from '#/cv/queries'
import { createFromImport, parseUpload } from '#/server/import'
import { DEFAULT_THEME_ID, getTheme } from '#/themes'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Preview } from '#/components/editor/preview'
import type { CvDoc } from '#/cv/schema'

export const Route = createFileRoute('/import')({
    head: () => ({ meta: [{ title: 'Import CV · CV Builder' }] }),
    component: ImportPage,
})

async function toBase64(file: File): Promise<string> {
    const buf = new Uint8Array(await file.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(bin)
}

function ImportPage() {
    const status = useQuery(aiStatusQuery())
    const qc = useQueryClient()
    const navigate = useNavigate()
    const [file, setFile] = useState<File | null>(null)
    const [text, setText] = useState('')
    const [result, setResult] = useState<{ doc: CvDoc; via: 'json' | 'ai' } | null>(null)
    const [name, setName] = useState('Imported CV')

    const isJson = file?.name.toLowerCase().endsWith('.json') ?? false
    const aiOk = status.data?.configured ?? false

    const parse = useMutation({
        mutationFn: async () => {
            if (file) {
                if (file.size > 10 * 1024 * 1024) throw new Error('File is larger than 10 MB.')
                return parseUpload({
                    data: { fileName: file.name, mime: file.type, base64: await toBase64(file) },
                })
            }
            return parseUpload({ data: { fileName: 'pasted.txt', mime: 'text/plain', text } })
        },
        onSuccess: (r) => {
            setResult(r)
            if (r.doc.basics.name) setName(`${r.doc.basics.name} (imported)`)
        },
    })

    const create = useMutation({
        mutationFn: () => {
            if (!result) throw new Error('Nothing to save')
            return createFromImport({ data: { name: name.trim() || 'Imported CV', doc: result.doc } })
        },
        onSuccess: async ({ id }) => {
            await qc.invalidateQueries({ queryKey: ['variants'] })
            navigate({ to: '/cv/$variantId', params: { variantId: id } })
        },
    })

    const canParse = (file && (isJson || aiOk)) || (!file && text.trim().length >= 50 && aiOk)
    const theme = getTheme(DEFAULT_THEME_ID)

    return (
        <div className="flex h-dvh flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b-2 bg-card px-4 py-2">
                <Button asChild variant="ghost" size="icon" aria-label="Back to all CVs">
                    <Link to="/">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="text-lg font-extrabold tracking-tight">Import a CV</h1>
                {result && (
                    <div className="ml-auto flex items-center gap-2">
                        <Input
                            className="h-8 w-64"
                            aria-label="New CV name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <Button disabled={create.isPending} onClick={() => create.mutate()}>
                            {create.isPending && <Loader2 className="animate-spin" />} Create CV
                        </Button>
                    </div>
                )}
            </header>
            {create.error && (
                <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm">{create.error.message}</div>
            )}

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(380px,480px)_1fr]">
                <aside className="min-h-0 space-y-4 overflow-y-auto border-r p-4 text-sm">
                    <p className="text-muted-foreground">
                        Upload an existing CV: PDF, Word (.docx), text, or a JSON Resume file. PDF, Word and text are
                        read by AI ({status.data?.model ?? '…'}); JSON is mapped directly. Check the result before
                        saving: nothing is created until you click “Create CV”.
                    </p>
                    {!aiOk && status.isSuccess && (
                        <div className="rounded-md border border-warn bg-warn-wash p-3 text-warn-ink">
                            AI is not set up, so only JSON Resume files can be imported. Add{' '}
                            <code>ANTHROPIC_API_KEY</code> to <code>.env</code> to import PDF and Word files.
                        </div>
                    )}
                    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed bg-card p-6 text-center hover:bg-muted/40">
                        <FileUp className="text-muted-foreground size-6" />
                        <span className="font-medium">{file ? file.name : 'Choose a file'}</span>
                        <span className="text-muted-foreground text-xs">.pdf, .docx, .txt, .md, .json, max 10 MB</span>
                        <input
                            type="file"
                            className="sr-only"
                            aria-label="CV file"
                            accept=".pdf,.docx,.txt,.md,.json,application/pdf,application/json,text/plain"
                            onChange={(e) => {
                                setFile(e.target.files?.[0] ?? null)
                                setResult(null)
                            }}
                        />
                    </label>
                    {!file && (
                        <div className="space-y-1">
                            <label htmlFor="paste" className="text-muted-foreground text-xs">
                                …or paste the text of your CV (e.g. copied from LinkedIn)
                            </label>
                            <Textarea id="paste" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
                        </div>
                    )}
                    {file && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
                            Clear file
                        </Button>
                    )}
                    <Button className="w-full" disabled={!canParse || parse.isPending} onClick={() => parse.mutate()}>
                        {parse.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                        {parse.isPending ? 'Reading… (can take a minute)' : 'Read CV'}
                    </Button>
                    {parse.error && <p className="text-destructive">{parse.error.message}</p>}
                    {result && (
                        <p className="text-win-ink">
                            Read {result.doc.work.length} positions, {result.doc.education.length} education entries,{' '}
                            {result.doc.skills.length} skill groups
                            {result.doc.custom.length ? ` and ${result.doc.custom.length} other sections` : ''}. Review
                            the preview, then create the CV. You can edit everything afterwards.
                        </p>
                    )}
                </aside>
                <section className="min-h-0 overflow-y-auto bg-muted/60 px-4">
                    {result ? (
                        <Preview doc={result.doc} themeId={theme.id} tokens={theme.defaults} />
                    ) : (
                        <p className="text-muted-foreground py-20 text-center text-sm">The preview appears here.</p>
                    )}
                </section>
            </div>
        </div>
    )
}
