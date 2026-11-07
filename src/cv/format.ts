const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
]

export type MonthStyle = 'short' | 'long'

/** "2021-03" → "Mar 2021" (or "March 2021"), "2021" → "2021", anything else passes through. */
export function formatDate(value: string, months: MonthStyle = 'short'): string {
    const v = value.trim()
    const m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(v)
    if (m) {
        const month = (months === 'long' ? MONTHS_LONG : MONTHS)[Number(m[2]) - 1]
        return month ? `${month} ${m[1]}` : m[1]
    }
    return v
}

export function formatRange(start: string, end: string, presentLabel = 'Present', months: MonthStyle = 'short') {
    const s = formatDate(start, months)
    const e = end.trim() ? formatDate(end, months) : start.trim() ? presentLabel : ''
    if (s && e) return `${s} – ${e}`
    return s || e
}

/** Strip protocol for display: "https://x.dev/" → "x.dev". */
export function displayUrl(url: string): string {
    return url
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
}

export function hrefFor(url: string): string {
    if (!url) return url
    if (/^(https?:|mailto:|tel:)/.test(url)) return url
    return `https://${url}`
}
