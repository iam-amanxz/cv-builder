import { useEffect, useState } from 'react'

/**
 * Renders a timestamp in the viewer's locale/timezone. The server (UTC in
 * Docker) renders ISO first; the client swaps it after hydration so the two
 * never mismatch.
 */
export function LocalTime({ value }: { value: Date | string | number }) {
    const d = new Date(value)
    const [text, setText] = useState(() => d.toISOString().slice(0, 16).replace('T', ' '))
    useEffect(() => setText(d.toLocaleString()), [d.getTime()])
    return <time dateTime={d.toISOString()}>{text}</time>
}
