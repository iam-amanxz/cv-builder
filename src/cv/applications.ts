/** Application pipeline stages, in board order. Shared by DB schema and UI. */
export const APPLICATION_STATUSES = ['draft', 'applied', 'interview', 'offer', 'rejected', 'ghosted'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/** Where you stand on a skill a job asked for. */
export const SKILL_STATUSES = ['open', 'learning', 'have', 'ignore'] as const
export type SkillStatus = (typeof SKILL_STATUSES)[number]

/** Same skill, same key: "Argo CD", "argo-cd" and "ArgoCD " all become "argocd". */
export function skillKey(skill: string): string {
    return skill
        .toLowerCase()
        .replace(/[\s\-_.]+/g, '')
        .trim()
}
