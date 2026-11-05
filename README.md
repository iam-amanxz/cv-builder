# CV Builder

Personal CV tool: structured content, themes, versioned PDF exports. Plan: [PLAN.md](PLAN.md).

## Run (Docker)

```sh
cp .env.example .env        # optional until AI features land
docker compose up -d --build
open http://localhost:3000
```

Data lives in `./data` (`cv.db` + `exports/`). Back up by copying that folder.
The container binds to `127.0.0.1` only — there is no auth.

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
