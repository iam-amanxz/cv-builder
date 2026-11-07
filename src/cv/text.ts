/** House style: no em dashes anywhere in generated or rendered text. */
export const NO_EM_DASH_RULE = 'Never use em dashes (—). Use a comma, colon, parentheses or a new sentence instead.'

/** Replace em dashes with a comma, so "a — b" reads "a, b". */
export function stripEmDashes(text: string): string {
    return text
        .replace(/^\s*—\s*/, '')
        .replace(/\s*—\s*$/, '')
        .replace(/\s*—\s*/g, ', ')
}

/** Apply stripEmDashes to every string inside a JSON-like value. */
export function stripEmDashesDeep<T>(value: T): T {
    if (typeof value === 'string') return stripEmDashes(value) as T
    if (Array.isArray(value)) return value.map(stripEmDashesDeep) as T
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripEmDashesDeep(v)])) as T
    return value
}
