import { chromium } from 'playwright'
import type { Browser } from 'playwright'

/**
 * One shared Chromium per process; a fresh page per job.
 * The print route is rendered by this same server, so the PDF is exactly
 * what the preview shows.
 */
const g = globalThis as unknown as { __cvBrowser?: Promise<Browser> }

function browser(): Promise<Browser> {
    if (!g.__cvBrowser) {
        g.__cvBrowser = chromium
            .launch({ args: ['--no-sandbox', '--font-render-hinting=none'] })
            .then((b) => {
                b.on('disconnected', () => (g.__cvBrowser = undefined))
                return b
            })
            .catch((err: unknown) => {
                g.__cvBrowser = undefined
                throw err
            })
    }
    return g.__cvBrowser
}

export function internalBaseUrl(): string {
    return process.env.APP_INTERNAL_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
}

/** Render a page of this app (e.g. `/print/<snapshotId>`) to PDF. */
export async function renderPdf(pagePath: string): Promise<Buffer> {
    const b = await browser()
    const context = await b.newContext()
    const page = await context.newPage()
    try {
        const res = await page.goto(`${internalBaseUrl()}${pagePath}`, {
            waitUntil: 'load',
            timeout: 30_000,
        })
        if (!res || !res.ok()) {
            throw new Error(`Print page failed: HTTP ${res?.status() ?? 'no response'}`)
        }
        await page.waitForSelector('[data-cv-ready]', { timeout: 15_000 })
        await page.evaluate(() => document.fonts.ready)
        return await page.pdf({ preferCSSPageSize: true, printBackground: true })
    } finally {
        await context.close()
    }
}

export interface LoadedPage {
    url: string
    title: string
    siteName: string
    /** schema.org JobPosting embedded in the page, when the site provides one. */
    jobPosting: {
        title: string
        company: string
        location: string
        description: string
    } | null
    /** Visible text of the main content. */
    text: string
}

/**
 * Open an external page in headless Chromium (so JavaScript-rendered job boards
 * work) and pull out its text and any embedded JobPosting data.
 */
export async function loadExternalPage(url: string): Promise<LoadedPage> {
    const b = await browser()
    const context = await b.newContext({
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
    })
    const page = await context.newPage()
    try {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        if (!res) throw new Error('The page did not respond')
        if (res.status() >= 400) throw new Error(`The page returned HTTP ${res.status()}`)
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
        return await page.evaluate(() => {
            const meta = (sel: string) => document.querySelector<HTMLMetaElement>(sel)?.content.trim() ?? ''
            const htmlToText = (raw: string) => {
                // Some sites escape the HTML inside JSON-LD (&lt;p&gt;); unescape once.
                const html = /&lt;\w/.test(raw)
                    ? new DOMParser().parseFromString(raw, 'text/html').body.textContent
                    : raw
                const el = new DOMParser().parseFromString(html.replace(/<li[^>]*>/gi, '<li>- '), 'text/html').body
                el.querySelectorAll('p, li, br, h1, h2, h3, h4, div').forEach((n) => n.append('\n'))
                return el.textContent.replace(/\n{3,}/g, '\n\n').trim()
            }
            type Json = Record<string, unknown>
            const flatten = (v: unknown): Json[] =>
                Array.isArray(v)
                    ? v.flatMap(flatten)
                    : v && typeof v === 'object'
                      ? [v as Json, ...flatten((v as Json)['@graph'])]
                      : []
            let jobPosting = null
            for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
                try {
                    const found = flatten(JSON.parse(s.textContent || 'null')).find((o) =>
                        [o['@type']].flat().includes('JobPosting'),
                    )
                    if (!found) continue
                    const org = found.hiringOrganization as Json | undefined
                    const loc = [found.jobLocation].flat()[0] as Json | undefined
                    const addr = loc?.address as Json | undefined
                    jobPosting = {
                        title: String(found.title ?? ''),
                        company: String(org?.name ?? ''),
                        location: [addr?.addressLocality, addr?.addressCountry]
                            .filter((x) => typeof x === 'string' && x)
                            .join(', '),
                        description: htmlToText(String(found.description ?? '')),
                    }
                    break
                } catch {
                    // Malformed JSON-LD: ignore it and fall back to page text.
                }
            }
            const main = document.querySelector('main, [role="main"], article') ?? document.body
            return {
                url: location.href,
                title: meta('meta[property="og:title"]') || document.title.trim(),
                siteName: meta('meta[property="og:site_name"]'),
                jobPosting,
                text: (main as HTMLElement).innerText
                    .replace(/\n{3,}/g, '\n\n')
                    .trim()
                    .slice(0, 40_000),
            }
        })
    } finally {
        await context.close()
    }
}
