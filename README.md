# Primo Estimator (demo)

Internal estimating tool for Primo Group Services. Stores past AV proposals and drafts a
starting estimate for a new job from a short brief. See `CLAUDE.md` for domain context and
`BUILD_PLAN.md` for the phased plan.

## Stack
Next.js 16 (App Router, TypeScript), Tailwind v4, shadcn/ui-style components,
Supabase (Postgres + pgvector + Storage), Anthropic API, Voyage AI embeddings (optional).

## Local setup
```bash
npm install
cp .env.example .env.local   # fill in Supabase, Anthropic, Voyage, DEMO_PASSWORD
npm run dev
```
Put the sample proposals in `seed/docs/` (gitignored). See `seed/README.md`.

Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run seed`.

## Ingestion (Phase 1)
- **Upload** (`/upload`): the file goes to the private `documents` bucket, Claude (`claude-sonnet-5`,
  structured output against `lib/schemas/extraction.ts`) extracts header, sections, every BOM row,
  optional items, scope, assumptions, exclusions and cost drivers. `.docx` is converted with mammoth
  and cut at "Acceptance & Payment"; PDFs go to Claude as a document block.
- **Post-processing** (`lib/ingest/`): the roll-up tree is rebuilt from sums (`tree.ts`), labour
  activities are tagged and hours derived as total ÷ rate where a rate-card rate fits within 1%
  (`labour.ts`), then lines are reconciled to roll-ups, section totals, the subtotal and GST
  (`validate.ts`).
- **Review** (`/documents/[id]`): rendered sections, the pass/fail report and the raw JSON.
  Confirm saves everything in one transaction via the `save_job` SQL function; the same job number
  becomes a new revision and earlier revisions are marked superseded.
- **Seed**: `npm run seed` ingests the four library documents from `seed/docs` (6570 PDF first, then
  the expanded 6570 .docx so it is the active revision, then 6401 and 6521), prints the validation
  report and 6570's derived hours, and only saves documents that reconcile (`--force` overrides,
  `--dry` skips writes). 6427 is never seeded.
- Tests: `npm run test` covers tree inference, bundle de-duplication, validation and hour
  derivation with the 6570 figures documented in CLAUDE.md.

## Database
Migrations live in `supabase/migrations/`. Apply them to your Supabase project either with the
CLI or by pasting into the SQL editor:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

The first migration enables `vector` and `pg_trgm`, creates all tables with RLS enabled (no anon
policies: all access is server-side via the service role key), creates the private `documents`
storage bucket, seeds `rate_card` with the hypothesis rates, and installs a stub `match_jobs`
function that Phase 2 replaces.

## Password gate
`proxy.ts` redirects every page to `/login` unless the session cookie matches a hash of
`DEMO_PASSWORD`. If `DEMO_PASSWORD` is unset the gate is open (handy for local dev; always set
it on Vercel).

## Deploy (Vercel)
1. Push this repo (keep it **private**: it will hold client data).
2. In Vercel: New Project → import the repo. Framework preset: Next.js. No build overrides needed.
3. Add the environment variables from `.env.example` (Production + Preview).
4. Deploy. The home page shows an environment check for Supabase, Anthropic, Voyage and the gate.
