import { createContext, useContext } from 'react'

/**
 * What in-editor AI helpers need from the editor page: whether AI is set up,
 * and a way to save pending edits + snapshot before an AI change lands.
 */
export interface AiEditorContext {
    variantId: string
    enabled: boolean
    model: string
    beforeApply: (label: string) => Promise<void>
}

const Ctx = createContext<AiEditorContext | null>(null)
export const AiProvider = Ctx.Provider

export function useAiEditor(): AiEditorContext | null {
    return useContext(Ctx)
}
