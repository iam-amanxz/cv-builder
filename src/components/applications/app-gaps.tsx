import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Sparkles, X } from 'lucide-react'
import { addGap, analyseGaps, listApplicationGaps, removeGap } from '#/server/gaps'
import { aiStatusQuery } from '#/cv/queries'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'

export const applicationGapsQuery = (applicationId: string) =>
    queryOptions({
        queryKey: ['gaps', 'application', applicationId],
        queryFn: () => listApplicationGaps({ data: { applicationId } }),
    })

/** Skills this job asks for that the CV lacks: list, add by hand, or find with AI. */
export function ApplicationGaps({ applicationId, hasDescription }: { applicationId: string; hasDescription: boolean }) {
    const qc = useQueryClient()
    const gaps = useQuery(applicationGapsQuery(applicationId))
    const ai = useQuery(aiStatusQuery())
    const [skill, setSkill] = useState('')
    const [importance, setImportance] = useState<'required' | 'nice'>('required')
    const refresh = () => qc.invalidateQueries({ queryKey: ['gaps'] })

    const add = useMutation({
        mutationFn: () => addGap({ data: { applicationId, skill, importance, requirement: '' } }),
        onSuccess: async () => {
            setSkill('')
            await refresh()
        },
    })
    const remove = useMutation({
        mutationFn: (id: string) => removeGap({ data: { id } }),
        onSuccess: refresh,
    })
    const analyse = useMutation({
        mutationFn: () => analyseGaps({ data: { applicationId } }),
        onSuccess: refresh,
    })
    const list = gaps.data ?? []

    return (
        <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
                <h3 className="font-medium">Skill gaps</h3>
                <Link to="/gaps" className="text-muted-foreground ml-auto text-xs underline">
                    All gaps
                </Link>
            </div>
            {list.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                    {list.map((g) => (
                        <li
                            key={g.id}
                            title={g.requirement || undefined}
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2 text-xs',
                                g.importance === 'required'
                                    ? 'border-bad bg-bad-wash text-bad-ink'
                                    : 'bg-muted text-muted-foreground',
                            )}
                        >
                            {g.skill}
                            <button
                                className="rounded-full p-0.5 hover:bg-black/10"
                                aria-label={`Remove ${g.skill}`}
                                onClick={() => remove.mutate(g.id)}
                            >
                                <X className="size-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-muted-foreground text-xs">None recorded for this job yet.</p>
            )}
            <form
                className="flex gap-1.5"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (skill.trim()) add.mutate()
                }}
            >
                <Input
                    className="h-8"
                    placeholder="Add a skill, e.g. Terraform"
                    aria-label="Skill gap"
                    value={skill}
                    onChange={(e) => setSkill(e.target.value)}
                />
                <select
                    aria-label="Importance"
                    className="h-8 rounded-md border bg-background px-1 text-xs"
                    value={importance}
                    onChange={(e) => setImportance(e.target.value as typeof importance)}
                >
                    <option value="required">Required</option>
                    <option value="nice">Nice to have</option>
                </select>
                <Button type="submit" size="sm" variant="outline" className="h-8" aria-label="Add skill gap">
                    <Plus />
                </Button>
            </form>
            <Button
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={!(ai.data?.configured ?? false) || !hasDescription || analyse.isPending}
                title={
                    !ai.data?.configured
                        ? 'Set ANTHROPIC_API_KEY in .env to enable AI'
                        : hasDescription
                          ? undefined
                          : 'Add and save the job description first'
                }
                onClick={() => analyse.mutate()}
            >
                {analyse.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Find gaps with AI
            </Button>
            {analyse.data && <p className="text-muted-foreground text-xs">Found {analyse.data.found}.</p>}
            {(add.error ?? analyse.error) && (
                <p className="text-destructive text-xs">{(add.error ?? analyse.error)?.message}</p>
            )}
        </div>
    )
}
