import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link2, Loader2, X } from 'lucide-react'
import { createFromJob, fetchJob } from '#/server/jobs'
import { aiStatusQuery, variantsQuery } from '#/cv/queries'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import type { FetchedJob } from '#/server/jobs'

const SOURCE_NOTE: Record<FetchedJob['source'], string> = {
    structured: "Read from the job site's own job data.",
    ai: 'Extracted from the page by AI.',
    page: 'Copied from the page text. Trim anything that is not part of the job.',
}

/** Paste a job link: read the posting, review it, then create the application (and a CV copy to tailor). */
export function JobImport({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<unknown> }) {
    const navigate = useNavigate()
    const variants = useQuery(variantsQuery())
    const ai = useQuery(aiStatusQuery())
    const aiOk = ai.data?.configured ?? false

    const [url, setUrl] = useState('')
    const [job, setJob] = useState<FetchedJob | null>(null)
    const [baseId, setBaseId] = useState<string>('')
    const [copyCv, setCopyCv] = useState(true)
    const [findGaps, setFindGaps] = useState(true)
    const master = variants.data?.find((v) => v.isMaster) ?? variants.data?.at(0)
    const base = baseId || master?.id || ''

    const fetchIt = useMutation({
        mutationFn: () => fetchJob({ data: { url } }),
        onSuccess: setJob,
    })
    const create = useMutation({
        mutationFn: () => {
            if (!job) throw new Error('Read a job first')
            return createFromJob({
                data: {
                    url: job.url,
                    company: job.company,
                    role: job.role,
                    location: job.location,
                    jobDescription: job.description,
                    baseVariantId: base || null,
                    copyCv: copyCv && !!base,
                    findGaps: findGaps && aiOk,
                },
            })
        },
        onSuccess: async (r) => {
            await onCreated()
            if (r.gapsError) alert(`Application created, but the gap analysis failed: ${r.gapsError}`)
            if (r.copied && r.variantId)
                navigate({
                    to: '/cv/$variantId/tailor',
                    params: { variantId: r.variantId },
                    search: { app: r.applicationId },
                })
            else onClose()
        },
    })
    const set = (patch: Partial<FetchedJob>) => job && setJob({ ...job, ...patch })

    return (
        <aside className="w-[28rem] shrink-0 space-y-3 overflow-y-auto border-l bg-card p-4 text-sm">
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-medium">
                    <Link2 className="size-4" /> Add a job from a link
                </h2>
                <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
                    <X />
                </Button>
            </div>
            <form
                className="flex gap-2"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (url.trim()) fetchIt.mutate()
                }}
            >
                <Input
                    autoFocus
                    aria-label="Job link"
                    placeholder="https://…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />
                <Button type="submit" disabled={!url.trim() || fetchIt.isPending}>
                    {fetchIt.isPending ? <Loader2 className="animate-spin" /> : null}
                    {fetchIt.isPending ? 'Reading…' : 'Read job'}
                </Button>
            </form>
            {fetchIt.error && <p className="text-destructive">{fetchIt.error.message}</p>}

            {job && (
                <>
                    <p className="text-muted-foreground text-xs">{SOURCE_NOTE[job.source]} Check it before saving.</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1">
                            <Label htmlFor="j-company">Company</Label>
                            <Input
                                id="j-company"
                                value={job.company}
                                onChange={(e) => set({ company: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="j-role">Role</Label>
                            <Input id="j-role" value={job.role} onChange={(e) => set({ role: e.target.value })} />
                        </div>
                        <div className="col-span-2 grid gap-1">
                            <Label htmlFor="j-location">Location</Label>
                            <Input
                                id="j-location"
                                value={job.location}
                                onChange={(e) => set({ location: e.target.value })}
                            />
                        </div>
                        <div className="col-span-2 grid gap-1">
                            <Label htmlFor="j-desc">Job description</Label>
                            <Textarea
                                id="j-desc"
                                rows={12}
                                value={job.description}
                                onChange={(e) => set({ description: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                        <div className="grid gap-1">
                            <Label htmlFor="j-base">CV for this job</Label>
                            <select
                                id="j-base"
                                className="h-9 w-full rounded-md border bg-background px-2"
                                value={base}
                                onChange={(e) => setBaseId(e.target.value)}
                            >
                                <option value="">None</option>
                                {variants.data?.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <label className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={copyCv}
                                disabled={!base}
                                onChange={(e) => setCopyCv(e.target.checked)}
                            />
                            <span>
                                Make a copy of this CV for the job and open it in Tailor
                                <span className="text-muted-foreground block text-xs">
                                    The original stays as it is.
                                </span>
                            </span>
                        </label>
                        <label className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={findGaps && aiOk}
                                disabled={!aiOk}
                                onChange={(e) => setFindGaps(e.target.checked)}
                            />
                            <span>
                                Find skill gaps with AI
                                <span className="text-muted-foreground block text-xs">
                                    {aiOk
                                        ? 'Adds what this job asks for that your CV lacks to the gap tracker.'
                                        : 'Needs ANTHROPIC_API_KEY. You can add gaps by hand later.'}
                                </span>
                            </span>
                        </label>
                    </div>

                    {create.error && <p className="text-destructive">{create.error.message}</p>}
                    <Button
                        className="w-full"
                        disabled={!job.company.trim() || create.isPending}
                        onClick={() => create.mutate()}
                    >
                        {create.isPending && <Loader2 className="animate-spin" />}
                        {create.isPending
                            ? 'Creating…'
                            : copyCv && base
                              ? 'Create application and tailor CV'
                              : 'Create application'}
                    </Button>
                </>
            )}
        </aside>
    )
}
