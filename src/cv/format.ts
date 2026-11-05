const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2021-03" → "Mar 2021", "2021" → "2021", anything else passes through. */
export function formatDate(value: string): string {
    const v = value.trim()
    const m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(v)
    if (m) {
        const month = MONTHS[Number(m[2]) - 1]
        return month ? `${month} ${m[1]}` : m[1]
    }
    return v
}

export function formatRange(start: string, end: string, presentLabel = 'Present') {
    const s = formatDate(start)
    const e = end.trim() ? formatDate(end) : start.trim() ? presentLabel : ''
    if (s && e) return `${s} – ${e}`
    return s || e
}

/** Strip protocol for display: "https://x.dev/" → "x.dev". */
export function displayUrl(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function hrefFor(url: string): string {
    if (!url) return url
    if (/^(https?:|mailto:|tel:)/.test(url)) return url
    return `https://${url}`
}
