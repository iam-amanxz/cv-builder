import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { nanoid } from 'nanoid'
import { getDb, schema } from '#/db'
import type { z } from 'zod'
import { NO_EM_DASH_RULE, stripEmDashesDeep } from '#/cv/text'

export const AI_MODEL = process.env.AI_MODEL || 'claude-opus-5-5'

/** $ per million tokens (input, output). Unknown models are logged without cost. */
const PRICING: Record<string, [number, number]> = {
    'claude-opus-5-5': [4, 20],
    'claude-sonnet-5-5': [2, 10],
    'claude-haiku-5-5': [0.1, 0.5],
    'claude-fable-5-1': [10, 50],
}

export function aiConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
}

let client: Anthropic | undefined
function getClient(): Anthropic {
    if (!aiConfigured()) {
        throw new Error('AI is not configured: set ANTHROPIC_API_KEY in .env and restart.')
    }
    client ??= new Anthropic()
    return client
}

export type AiKind = (typeof schema.aiRuns.$inferInsert)['kind']

/**
 * One structured call: the response is validated against `output` (Zod) by
 * the SDK. Refusals are retried server-side on a fallback model
 * (fallbacks: 'default'); a refusal that survives that is surfaced as an error.
 * Every call (success or failure) is written to ai_runs with token usage.
 */
export async function runStructured<TSchema extends z.ZodType>(opts: {
    kind: AiKind
    variantId?: string
    system: string
    /** Plain text, or content blocks (e.g. a PDF document followed by text). */
    prompt: string | Anthropic.Beta.BetaContentBlockParam[]
    output: TSchema
    effort?: 'low' | 'medium' | 'high'
    logInput: unknown
}): Promise<z.infer<TSchema>> {
    const started = Date.now()
    const log = (
        row: Partial<typeof schema.aiRuns.$inferInsert> & Pick<typeof schema.aiRuns.$inferInsert, 'status'>,
    ) => {
        const inTok = row.inputTokens ?? 0
        const outTok = row.outputTokens ?? 0
        const price = PRICING[row.model ?? AI_MODEL] as [number, number] | undefined
        getDb()
            .insert(schema.aiRuns)
            .values({
                id: nanoid(12),
                kind: opts.kind,
                variantId: opts.variantId,
                model: AI_MODEL,
                input: opts.logInput,
                durationMs: Date.now() - started,
                costUsd: price ? (inTok * price[0] + outTok * price[1]) / 1_000_000 : null,
                ...row,
            })
            .run()
    }

    try {
        const res = await getClient().beta.messages.parse({
            model: AI_MODEL,
            max_tokens: 16000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            system: `${opts.system}

${NO_EM_DASH_RULE}`,
            messages: [{ role: 'user', content: opts.prompt }],
            output_config: { format: betaZodOutputFormat(opts.output), effort: opts.effort ?? 'medium' },
        })
        const usage = {
            model: res.model,
            inputTokens: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0),
            outputTokens: res.usage.output_tokens,
        }
        if (res.stop_reason === 'refusal') {
            log({ ...usage, status: 'refusal', error: res.stop_details?.explanation ?? 'refused' })
            throw new Error('The model declined this request.')
        }
        if (res.stop_reason === 'max_tokens' || !res.parsed_output) {
            log({ ...usage, status: 'error', error: `No valid output (stop_reason: ${res.stop_reason})` })
            throw new Error('The AI response was incomplete. Try again.')
        }
        const output = stripEmDashesDeep(res.parsed_output)
        log({ ...usage, status: 'ok', output })
        return output
    } catch (err) {
        if (err instanceof Anthropic.APIError) {
            log({ status: 'error', error: `${err.status ?? ''} ${err.message}`.trim() })
            if (err instanceof Anthropic.AuthenticationError) throw new Error('Anthropic API key was rejected.')
            if (err instanceof Anthropic.RateLimitError)
                throw new Error('Rate limited by the API. Wait a moment and retry.')
            throw new Error(`AI request failed: ${err.message}`)
        }
        throw err
    }
}
