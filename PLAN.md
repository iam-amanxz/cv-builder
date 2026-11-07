# CV Builder: Plan

Personal, single-user CV tool. Runs locally in Docker. Keeps every version, supports themes, exports PDF/DOCX, and uses AI to help write and tailor.

## 1. Stack

| Concern       | Choice                                                                | Why                                                            |
| ------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Framework     | **TanStack Start** (React 19, file routes, server functions)          | Requested; server functions remove the need for a separate API |
| Data fetching | TanStack Query (via Start loaders + server fns)                       | Cache + optimistic autosave                                    |
| Forms         | TanStack Form + Zod                                                   | Same Zod schema validates editor, DB, and AI output            |
| UI            | shadcn (base-ui) + Tailwind v4 + Inter                                | Matches `../template` conventions                              |
| DB            | **SQLite** + Drizzle ORM (`better-sqlite3`)                           | One file, trivial backup, JSON columns                         |
| PDF           | **Playwright (Chromium)** `page.pdf()`                                | Prints the exact preview HTML                                  |
| DOCX          | `docx` npm package                                                    | Native Word output                                             |
| AI            | Anthropic SDK, model configurable (default `claude-sonnet-5-5`)       | Structured output against the Zod schema                       |
| Diff          | `jsondiffpatch`                                                       | Version compare                                                |
| Package mgr   | bun (dev); Node runtime in container (Playwright is happiest on Node) |                                                                |

No auth: the container binds to `127.0.0.1` only.

## 2. Core design: content ≠ theme

```
CvDoc (JSON, Zod schema, JSON Resume–compatible)
   │
   ├─► Theme component (React) + theme tokens (CSS vars) ─► Preview iframe
   │                                                     └► /print/:snapshotId ─► Playwright ─► PDF
   └─► DOCX mapper (uses theme font + accent only) ─► .docx
```

- **CvDoc** = JSON Resume schema + extensions: `sectionOrder`, `hiddenSections`, `sectionTitles`, per-item `hidden`, bullet `tags`.
- **Theme** = a React component that receives `(doc, tokens)` + a token set (colors, fonts, size scale, spacing, layout `one-col | two-col`, page size `A4 | Letter`).
- Preview and PDF render **the same component** → what you see is what you export.
- Fonts are bundled locally (no network at render time).

## 3. Data model (SQLite)

```
variants      id, name, parent_id?, doc JSON, theme_id, theme_overrides JSON,
              is_master bool, archived bool, created_at, updated_at
snapshots     id, variant_id, label, doc JSON, theme_id, theme_tokens JSON (resolved),
              reason ('manual'|'export'|'ai-apply'|'restore'), created_at      -- immutable
themes        id, name, component_key, tokens JSON, builtin bool
exports       id, snapshot_id, format ('pdf'|'docx'|'json'|'md'), file_path, bytes, created_at
applications  id, company, role, jd_text, jd_url, snapshot_id, status
              ('draft'|'applied'|'interview'|'offer'|'rejected'|'ghosted'),
              applied_at, notes, created_at
bullet_bank   id, text, tags JSON, source_variant_id?, created_at
ai_runs       id, kind, variant_id?, input JSON, output JSON, model,
              input_tokens, output_tokens, created_at                         -- audit + cost
settings      key, value
```

### Versioning rules

- **Variant** = editable working copy (autosaved, debounced ~800ms). Master + forks ("Backend", "Academic", "1-page").
- **Snapshot** = frozen copy of doc **and resolved theme tokens** (so editing a theme later never changes an old snapshot's output).
- Snapshots are created: manually ("Save version"), automatically **on every export**, and **before applying any AI change** (instant undo).
- **Restore** = copy snapshot into the variant (itself creates a `restore` snapshot first). Nothing is ever destroyed.
- **Fork** = new variant from a variant or a snapshot.
- **Diff** = any two snapshots/variants side by side (field-level, with highlighted bullets).
- Exported files are kept on disk under `/data/exports/` and linked to their snapshot → "exactly what I sent to Company X".

## 4. Features

### Must (v1)

1. Editor: section forms (basics, work, education, projects, skills, certs, languages, custom), drag-reorder sections/items/bullets, hide toggles.
2. Live A4/Letter preview with page-break markers and **overflow warning** (“spills onto page 2 by 6 lines”).
3. Variants, snapshots, restore, fork, diff.
4. Themes: 4 built-ins (Classic, Modern two-column, Minimal, Compact) + token editor + "save as my theme".
5. Export: PDF, DOCX, JSON (JSON Resume), Markdown.
6. Backup: download the whole DB + exports as a zip; import it back.

### AI (v1)

All AI output is a **proposal**: shown as a diff, accepted per change, never silently written.

1. **Bullet coach**: rewrite a bullet (action + impact + metric), flag weak verbs/passive voice, ask for missing numbers.
2. **Tailor to job**: paste a JD → keyword gap list, match score, proposed reorder/hide of items, proposed bullet rewrites, suggested summary. Accepting creates a new variant (or updates the current one after a snapshot).
3. **Import**: upload an old PDF/DOCX (or LinkedIn export) → Claude extracts into CvDoc (validated by Zod) → review screen before saving.
4. **Cover letter**: generated from the CvDoc + JD, rendered with the same theme, exported like the CV.
5. **Summary/headline generator** from the doc.

Implementation: server functions only (API key never reaches the browser), structured output validated against Zod, retry once on validation failure, every call logged to `ai_runs` with token counts (settings page shows monthly spend).

### Should (v2)

- **Application tracker** (kanban by status), each entry linked to the exact snapshot sent.
- **Fit to N pages**: auto-tighten spacing/font within theme limits, then suggest which items to hide.
- **ATS check**: extract text from the generated PDF and verify reading order, contact info, section headings; warn on icons-only contacts, images, multi-column parse risk.
- **Bullet bank**: every bullet ever written, tagged and searchable; insert into any variant.
- **Interview prep** from a JD + variant (likely questions mapped to your bullets).

### Could (later)

- Multi-language variants (AI-assisted translation, linked to the source variant).
- Privacy mode (redact phone/address) per export.
- QR code / link to a hosted version (only if you ever expose it).
- Spell/grammar pass, British/American English toggle.

## 5. Routes

```
/                         dashboard: variants, recent exports, applications
/cv/$variantId            editor + live preview (split view)
/cv/$variantId/history    snapshots timeline, diff, restore, fork
/cv/$variantId/tailor     AI tailor-to-job flow
/themes                   theme gallery + token editor
/applications             tracker
/import                   AI import
/settings                 API key status, model, spend, backup/restore
/print/$snapshotId        bare render used by Playwright (internal)
```

## 6. Export pipeline

- **PDF**: server fn → create snapshot → Playwright (one shared browser instance, new page per job) opens `http://localhost:3000/print/:snapshotId` → `waitForFunction(document.fonts.ready)` → `page.pdf({ format, printBackground: true, preferCSSPageSize: true })` → write `/data/exports/{date}-{variant}-{snapshot}.pdf` → row in `exports` → download.
- Page breaks: `break-inside: avoid` on items, `@page` margins from theme tokens.
- **DOCX**: deliberately simple single-column, ATS-safe layout; carries theme font, accent color, and section order. Not a pixel copy of the theme; stated in the UI.

## 7. Docker

```
docker-compose.yml
  service app
    build: Dockerfile (base: mcr.microsoft.com/playwright:<pinned>-noble, Node runtime)
    ports: "127.0.0.1:3000:3000"
    volumes: ./data:/data          # cv.db, exports/, uploads/
    env_file: .env                 # ANTHROPIC_API_KEY, AI_MODEL
    restart: unless-stopped
```

- Migrations run on container start (Drizzle migrate).
- Image is large (~1.5 GB, because of Chromium), acceptable locally.
- Backup = copy `./data` (or use the in-app zip).

## 8. Project layout

```
cv-builder/
  src/
    routes/                 TanStack Start file routes (above)
    server/                 server fns: variants, snapshots, export, ai, themes
    db/                     drizzle schema, migrations
    cv/schema.ts            Zod CvDoc (single source of truth)
    themes/                 classic/, modern/, minimal/, compact/ + tokens.ts
    export/                 pdf.ts (playwright), docx.ts, markdown.ts
    ai/                     prompts, tasks (rewrite, tailor, import, letter)
    components/             editor, preview, diff, ui (shadcn)
  Dockerfile
  docker-compose.yml
  .env.example
```

## 9. Phases (each ends usable)

| #   | Deliverable                                                                                                           | Done when                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Scaffold Start + Docker + SQLite/Drizzle; Zod CvDoc; editor for all sections; Classic theme; live preview; PDF export | `docker compose up`, edit CV, download a correct PDF            |
| 2   | Variants, snapshots (manual + on export), history timeline, diff, restore, fork                                       | Can recover any exported version and see what changed           |
| 3   | Theme system: 3 more themes, token editor, custom themes; DOCX, JSON, MD export; overflow warning                     | Switch theme without losing content; DOCX opens cleanly in Word |
| 4   | AI: bullet coach, tailor-to-job, summary; proposal/diff-accept UI; `ai_runs` + spend view                             | Paste a JD → tailored variant in < 2 min                        |
| 5   | AI import (PDF/DOCX/LinkedIn), cover letters                                                                          | Old CV imported with minimal fixes                              |
| 6   | Application tracker, fit-to-page, ATS check, bullet bank, backup zip                                                  | -                                                               |

## 10. Risks / decisions noted

- **Theme snapshot drift**: solved by storing resolved tokens in the snapshot. Theme _components_ are code, so a component change can alter old renders → mitigated because exported files are stored on disk.
- **AI hallucinating experience**: tailor prompt is constrained to rephrase/reorder existing facts only; new claims are flagged, never auto-inserted.
- **Two-column themes vs ATS**: ATS check warns; DOCX is always single-column.
- **Playwright memory**: single browser reused, pages closed after each job.
