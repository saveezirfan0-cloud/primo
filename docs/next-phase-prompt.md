# Prompt for the next build session

Copy everything below the line into a new Claude Code chat opened on the `saveezirfan0-cloud/primo` repo,
branch `main`. The repo's `CLAUDE.md`, `BUILD_PLAN.md` and `README.md` are already in the tree and hold
the domain knowledge; this prompt tells the new session what is done and what to build next.

---

## Context

You are continuing the **Primo Estimator**, an internal app for Primo Group Services (AV integrator,
Prestons NSW). Read `CLAUDE.md` first for the domain, stack and conventions, then `README.md` and
`BUILD_PLAN.md`. Do not re-plan the parts that already exist.

**What already works, deployed at primo-plum.vercel.app (Vercel, production branch `main`):**

- Next.js 16 App Router + Tailwind + hand-written shadcn-style components. Password gate via
  `DEMO_PASSWORD` in `proxy.ts`. All AI calls server-side.
- Supabase project `primo` (Sydney). Tables: `jobs`, `sections`, `line_items`, `optional_items`,
  `documents`, `parts`, `rate_card`, `labour_standards`, `section_profiles`, `estimates`,
  `ingest_staging`. RLS on, service role only. Private storage bucket `documents`. Migrations live in
  `supabase/migrations/` and are all applied. RPCs: `save_job(jsonb)` with revisions,
  `save_job_from_staging(key)`.
- Ingestion (`lib/ingest/*`, `/upload`, `/documents/[id]`): PDF or .docx proposal → Claude structured
  extraction → tree from depth with sum validation → arithmetic reconciliation → review screen →
  confirm/discard, holdout flag. Four real jobs loaded (6570, 6401, 6521, plus 6427 as holdout).
- Knowledge (`lib/knowledge/*`, `/price-book`, `/rate-card`): price book with latest price per part,
  labour standards (hours per item or category), section profiles (cabling/consumables/freight ratios,
  overhead activity hours), rate card (INSTALL 95.10, ENGINEER 138, PROGRAM 144, PM 156 AUD/h),
  optional Voyage embeddings with per-job requests and 429 backoff.
- Matching (`lib/match/score.ts`): params 0.5 + vector-or-keywords 0.3 + category overlap 0.2, with
  reasons. Runs in TypeScript; the SQL `match_jobs` function is a stub.
- Drafting (`lib/draft/*`, `/estimates/new`, `/estimates/[id]`): brief → spec (Claude) → parts chosen
  among price book candidates (Claude) → deterministic pricing in `buildDraft` → scope/notes/exclusions
  text → editable draft with live totals, provenance badges, CSV export, Draft vs Actual comparison
  against a chosen job. Blind test on 6427 lands within 0.3% of the real $31,993.40.
- Tests: vitest, 42 passing (`npm test`). `npm run typecheck` runs `next typegen` then tsc.
  `npm run lint`. Scripts: `scripts/seed.ts` (`--offline`, `--holdout`), `scripts/demo.ts`.
- Docs: `docs/demo-brief.md`, `docs/test-briefs.md`, `docs/demo-checklist.md`.

**Hard rules that still apply:** every priced line carries `basis` + `confidence` + `source_job_number`;
Claude decides what, code decides how much; money AUD ex GST `numeric(12,2)`; never commit anything in
`/seed/docs`; never store bank details or client personal contacts; 6427 stays a holdout, never tune
rules to it; keep the demo working at every commit (run typecheck, lint and tests before pushing).

**Environment:** `.env.local` is gitignored and holds `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`,
`DEMO_PASSWORD`. Ask the user for them if the file is missing. The sandbox may not reach
`*.supabase.co` or `api.voyageai.com`; if so, apply migrations and data changes through the Supabase MCP
connector and run extraction offline as the seed script does.

## What to build next, in this order

Work one phase at a time. For each phase: branch from `main`, implement, add tests where logic exists,
run `npm run typecheck && npm run lint && npm test`, update `README.md`, commit, push, and tell the user
what to check on the deployed site before starting the next phase.

### Phase 5: Attachments and schematics
- New table `job_attachments` (job_id, kind: proposal | schematic | photo | other, filename, storage path,
  size, mime, uploaded_at, note). Migration in `supabase/migrations/`, RLS like the other tables.
- On `/jobs/[id]`: list attachments, upload one or more files to the `documents` bucket under
  `jobs/<job_number>/attachments/`, download via signed URL (short expiry, server-generated), delete.
- The existing source proposal should appear in that list as kind `proposal`.
- Schematics are stored and shown, not parsed. If a PDF schematic is attached, show its first page as a
  thumbnail if cheap to do; otherwise a file card is fine.

### Phase 6: Tags
- `tags text[]` on `jobs`, GIN index, editable inline on `/jobs/[id]` and shown as chips in `/library`.
- Library filter by tag and by room type. Suggest tags from params on ingestion (for example `hall`,
  `staged`, `dante`, `new-rack`) but let the user edit them.
- Matching: add a small tag-overlap term (weight ~0.1, take it from the keyword weight) and show matched
  tags in the reasons.

### Phase 7: Estimator feedback loop
- When a draft is saved, store the diff between the generated draft and the saved draft per line
  (qty, hours, unit price, added, removed) in an `estimate_adjustments` table.
- A `/insights` page that lists, per part and per activity, how often and by how much the estimator
  changed the generated value. No auto-tuning yet; just make the drift visible.
- Add a "Mark as issued" action on an estimate with the final subtotal, so future drafts can compare
  against issued values.

### Phase 8: Proposal output
- Generate a .docx from a saved estimate in Primo's proposal order: cover, letter, Scope of Works,
  Summary Pricing, Optional Items, Detailed Bill of Materials, Notes & Assumptions, Exclusions. Stop
  before Acceptance & Payment. Use the `docx` npm package. Match the AroFlo layout roughly, not exactly.
- Download button on `/estimates/[id]` next to the CSV.

### Phase 9: Breadth of data
- Bulk upload on `/upload`: multiple files, each processed in turn, with a queue view and per-file
  status. Move extraction to a background job if Vercel's 300 s limit is hit (Supabase queue table
  polled by a cron route is acceptable for now).
- Handle proposal templates that differ from the four seen so far: log unknown roll-up codes, unknown
  section shapes and unreconciled sections to a `review_notes` field instead of failing.
- After each batch, rebuild the knowledge layer automatically.

### Phase 10: Production hardening
- Replace the password gate with Supabase Auth email login and an `allowed_users` table; keep it single
  tenant. Roles: `estimator` (everything) and `viewer` (read only).
- Audit log of estimate saves and job confirmations (who, when).
- Server-side error reporting, retries on Anthropic 429/529, timeouts surfaced to the UI.
- Key rotation checklist in README; move Voyage to a paid tier or drop embeddings if not worth it.
- Security pass: signed URLs only, no service role in client bundles, rate limit on upload.

### Not in scope unless the user asks
AroFlo API sync, multi-tenant, billing, mobile layout beyond basic responsiveness.

## How to start
1. `git pull`, `npm install`, `npm run typecheck && npm test` to confirm a clean baseline.
2. Confirm with the user which phase to start on (default: Phase 5) and whether the deployed site
   should keep working throughout (default: yes).
3. Then build.
