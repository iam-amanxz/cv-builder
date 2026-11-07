# CV Builder

Personal CV tool: structured content, themes, every version kept, PDF/Word export, AI help. Plan: [PLAN.md](PLAN.md) (all six phases built).

## Features

- **Editor** with autosave, custom sections, reorder/hide; live A4/Letter preview with page breaks and an overflow warning + **Fit to page**
- **Themes**: Centered (default), Classic, Modern (two-column), Minimal, Compact; full token editor; saved "My themes"
- **Export**: PDF (pixel-identical to preview), Word (single-column, ATS-safe), Markdown, JSON Resume; every export is kept and linked to a frozen version
- **History**: saved versions, preview any version, field-level diff, restore (undoable), copy to a new CV
- **AI** (Claude): bullet coach, summary suggestions, tailor-to-job with match score and selectable edits, cover letters, import from PDF/Word/text. Every AI change snapshots first; usage and cost on the Settings page
- **ATS check**: renders the PDF and reads it back like a parser (contact, headings, reading order)
- **Applications** board linking each application to the exact file and letter sent
- **Add job from link**: paste a job posting URL; the app reads it (site job data, AI, or page text), creates the application and optionally a CV copy to tailor
- **Interview prep** per CV: likely questions with the CV bullets that answer them, STAR outlines, gaps to prepare for, questions to ask; copy as text
- **Skill gaps**: what the jobs you apply for ask for and your CV lacks, counted across all applications, with a status per skill (to learn, learning, have, ignore)
- **Bullet bank** across all CVs and versions; **backup/restore** as a zip

## Run (Docker)

```sh
cp .env.example .env        # add ANTHROPIC_API_KEY to enable AI features (optional)
docker compose up -d --build
open http://localhost:3000
```

Data lives in `./data` (`cv.db` + `exports/`). Back up by copying that folder.
The container binds to `127.0.0.1` only; there is no auth.

## Develop

```sh
bun install
npx playwright install chromium   # once, for PDF export
bun run dev                        # http://localhost:3000
```

| Script                               |                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `bun run typecheck` / `bun run lint` | checks                                                                          |
| `bun run db:generate`                | new migration after editing `src/db/schema.ts` (applied automatically on start) |
| `bun run docker:up` / `docker:logs`  | rebuild + start / follow logs                                                   |

## Layout

```
src/cv/            Zod CvDoc schema (source of truth), sample, formatting
src/themes/        theme components + tokens (Classic)
src/db/            Drizzle schema + connection (runs migrations on open)
src/server/        server functions; *.server.ts = server-only modules
src/components/editor/  section forms, preview, theme controls
src/routes/        /, /cv/$variantId, /print/$snapshotId (PDF source), /api/exports/$exportId
```

PDF export: snapshot the variant → Playwright opens `/print/:snapshotId` on this
same server → `page.pdf()` → file saved in `data/exports/` and recorded in `exports`.
