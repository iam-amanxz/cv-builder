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

export async function renderPdf(snapshotId: string): Promise<Buffer> {
    const b = await browser()
    const context = await b.newContext()
    const page = await context.newPage()
    try {
        const res = await page.goto(`${internalBaseUrl()}/print/${snapshotId}`, {
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
