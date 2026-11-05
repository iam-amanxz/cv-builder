import { useLayoutEffect, useRef, useState } from 'react'
import { getTheme, pageDims } from '#/themes'
import type { CvDoc } from '#/cv/schema'
import type { ThemeTokens } from '#/themes'

const PX_PER_MM = 96 / 25.4

/**
 * Live preview: renders the same theme component used by the print route,
 * on a paper of the chosen size, scaled to fit. Page-break lines are an
 * estimate (the PDF engine may push whole items to the next page).
 */
export function Preview({
  doc,
  themeId,
  tokens,
  onPageCount,
}: {
  doc: CvDoc
  themeId: string
  tokens: ThemeTokens
  onPageCount?: (n: number) => void
}) {
  const theme = getTheme(themeId)
  const dims = pageDims(tokens)
  const pageW = dims.widthMm * PX_PER_MM
  const pageH = dims.heightMm * PX_PER_MM
  const margin = tokens.marginMm * PX_PER_MM
  const contentH = pageH - 2 * margin

  const outerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const content = contentRef.current
    if (!outer || !content) return
    const ro = new ResizeObserver(() => {
      setScale(Math.min(1.25, (outer.clientWidth - 32) / pageW))
      setHeight(content.scrollHeight)
    })
    ro.observe(outer)
    ro.observe(content)
    return () => ro.disconnect()
  }, [pageW])

  const pages = Math.max(1, Math.ceil(height / contentH))
  useLayoutEffect(() => onPageCount?.(pages), [pages, onPageCount])

  return (
    <div ref={outerRef} className="w-full py-4">
      <div
        className="relative mx-auto"
        style={{ width: pageW * scale, height: pages * pageH * scale }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left bg-white shadow-lg ring-1 ring-black/5"
          style={{
            width: pageW,
            minHeight: pages * pageH,
            padding: margin,
            transform: `scale(${scale})`,
          }}
        >
          <div ref={contentRef}>
            <theme.Component doc={doc} tokens={tokens} />
          </div>
          {Array.from({ length: pages - 1 }, (_, i) => (
            <div
              key={i}
              className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-rose-400/70"
              style={{ top: margin + (i + 1) * contentH }}
            >
              <span className="absolute right-2 -top-5 rounded bg-rose-50 px-1.5 text-[11px] text-rose-600">
                page {i + 2}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
