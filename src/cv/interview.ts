import type { InterviewPrep } from '#/ai/schemas'

export const QUESTION_CATEGORIES = {
    technical: 'Technical',
    'system-design': 'System design',
    behavioural: 'Behavioural',
    leadership: 'Leadership',
    'role-fit': 'Role fit',
} as const

/** The whole prep as Markdown, for copying into notes or printing. */
export function prepToMarkdown(title: string, prep: InterviewPrep, notes: string): string {
    const out: string[] = [`# Interview prep: ${title}`, '', prep.fitSummary, '', '## Likely questions', '']
    prep.questions.forEach((q, i) => {
        out.push(`### ${i + 1}. ${q.question}`, `_${QUESTION_CATEGORIES[q.category]}. ${q.whyTheyAsk}_`, '')
        if (q.evidence.length) {
            out.push('Evidence:')
            for (const e of q.evidence) out.push(`- ${e.text} (${e.where})`)
            out.push('')
        }
        out.push(
            `- **Situation:** ${q.star.situation}`,
            `- **Task:** ${q.star.task}`,
            `- **Action:** ${q.star.action}`,
            `- **Result:** ${q.star.result}`,
            '',
            `Tip: ${q.tip}`,
            '',
        )
    })
    if (prep.gaps.length) {
        out.push('## Gaps to prepare for', '')
        for (const g of prep.gaps)
            out.push(
                `### ${g.skill} (${g.importance === 'required' ? 'required' : 'nice to have'})`,
                `> ${g.requirement}`,
                '',
                `- **Honest answer:** ${g.honestAnswer}`,
                `- **Prepare:** ${g.howToPrepare}`,
                '',
            )
    }
    out.push('## Questions to ask them', '', ...prep.questionsToAsk.map((q) => `- ${q}`), '')
    if (notes.trim()) out.push('## My notes', '', notes.trim(), '')
    return out.join('\n')
}
