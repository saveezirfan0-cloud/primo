# Claude Code Prompts — Primo Estimator Demo

## Setup (before the first prompt)
1. Create an empty **private** GitHub repo and clone it.
2. Put `CLAUDE.md` and `BUILD_PLAN.md` in the repo root.
3. Put the 5 sample files in `/seed/docs/` and add `/seed/docs` to `.gitignore`:
   - `Primo_Quote_JN6570__1_.docx` (expanded)
   - `Primo_Quote_JN6570_20260814.pdf`
   - `Primo_Quote_JN6401_20260803.pdf`
   - `Primo_Quote_JN6521_20260918.pdf`
   - `Primo_Quote_JN6427_20260720.pdf` (the holdout; don't seed it into the library)
4. Create the Supabase project and fill in `.env.local`.
5. Run one prompt per session phase. Use plan mode (Shift+Tab) for each, review the plan, then let it build.

---

## Prompt 1 — Kickoff + Phase 0

```
Read CLAUDE.md and BUILD_PLAN.md fully before doing anything. This is a demo-first
build for a client (Primo Group Services, AV integrator). The sample quotes are in
/seed/docs. Open and study them too, especially the expanded 6570 .docx.

Then do Phase 0 only:
- Scaffold Next.js (App Router, TS), Tailwind, shadcn/ui.
- Supabase server/browser clients, password middleware using DEMO_PASSWORD.
- SQL migrations in /supabase/migrations for the full data model in BUILD_PLAN.md
  (enable pgvector, fts column + trigger on jobs, private storage bucket "documents",
  seed rate_card with the hypothesis rates from CLAUDE.md).
- A stub match_jobs SQL function.
- Basic layout with nav: Library, Price Book, New Estimate.

Before writing code, give me a short plan plus a list of anything in the docs that
contradicts CLAUDE.md. Stop after Phase 0 and tell me how to apply migrations and deploy.
```

## Prompt 2 — Phase 1: Ingestion & validation

```
Phase 1 from BUILD_PLAN.md: ingestion and arithmetic validation.

Requirements:
- Upload page (PDF or .docx) -> Storage -> documents row.
- Truncate content at "Acceptance & Payment". .docx via mammoth (HTML, keep tables).
  PDFs go to Claude as a document block.
- Extraction with claude-sonnet-5 using a tool/JSON schema defined in Zod
  (/lib/schemas/extraction.ts): job header, sections, line items, optional items,
  params (full list in CLAUDE.md), scope paragraphs, assumptions, exclusions.
  Line items carry a parent_ref so the expanded tree can be represented.
- Post-processing in code (/lib/ingest/):
  - infer the parent/child tree from sums in expanded exports
  - avoid double counting when bundles are broken out
  - tag labour activity codes
  - derive hours = total / rate when it matches a rate_card rate within 1%
- Validation report: lines -> section totals -> subtotal, with tolerances from CLAUDE.md.
  Show pass/fail per section.
- Review screen: extracted data rendered as sections + the validation report,
  Confirm button saves everything transactionally. Same job_number = new revision.
- Script `npm run seed` that ingests 6570 (docx + pdf), 6401, 6521 without the UI
  review step, marks nothing as holdout, and prints validation results.
  Do NOT ingest 6427.

Write unit tests for the tree inference and validation using the real 6570 numbers.
Stop when seeding passes, and show me the validation output and 6570's derived labour hours.
```

## Prompt 3 — Phase 2: Knowledge layer & matching

```
Phase 2 from BUILD_PLAN.md.

- Build parts price book from all non-OFE equipment lines (latest price wins, count usage).
- Price Book page: search, latest price, jobs used in.
- Rate card page: editable.
- labour_standards: per part_number per activity (INSTALL, DE-COMM, CABLING-INSTALL)
  from jobs with labour detail; category medians as fallback; section overhead hours
  (ENGINEER, DOCUMENT, COMMISSION, PROGRAM, PROJECT-MANAGE, TRAIN, O&M, RUBBISH, ACCESS,
  WORKSHOP) stored relative to section equipment value.
- Embeddings with Voyage (fallback to FTS only if no key) on title + scope + params summary.
- Implement match_jobs as a hybrid: params similarity (weighted; room_type as filter),
  vector similarity, part/category overlap. Return top 3 with per-component scores and a
  short human-readable reason list.
- Library page and Job detail page (sections, BOM tree, params, scope, labour hours).

Test with the demo brief in BUILD_PLAN.md: 6570 should rank first. Show me the scores.
```

## Prompt 4 — Phase 3: Draft generation

```
Phase 3 from BUILD_PLAN.md. Principle: the LLM decides WHAT, code decides HOW MUCH.

1. Brief -> spec: claude-sonnet-5 with a Zod schema (sections, components with qty,
   new vs retained, params). Give it the top matched jobs' sections/parts as context so
   it uses Primo's vocabulary and section structure. Editable spec form in the UI.
2. Spec -> lines in pure TypeScript (/lib/draft/):
   - equipment priced from parts; Claude may choose among candidate part numbers from
     matched jobs, but prices always come from the price book
   - retained items as OFE $0
   - labour hours from labour_standards x rate_card, output with Primo activity codes
   - CABLING / CONS / FREIGHT as a ratio of section equipment value from the best-matching
     section, basis = ratio_estimate
   - every line: source_job_number, basis, confidence
3. Text: Claude drafts scope paragraphs, assumptions and exclusions adapted from matched
   jobs. It must only mention equipment present in the draft lines. Add a validator that
   checks this.
4. Draft page: editable table per section, provenance badges, live totals
   (ex GST, GST 10%, inc GST), save estimate, CSV export in Primo BOM column order.

Run the demo brief end to end and show me the full draft and totals.
```

## Prompt 5 — Phase 4: Demo polish

```
Phase 4 from BUILD_PLAN.md.

- Draft vs Actual view: when an estimate has compare_job_number, ingest that job as
  is_holdout=true (excluded from matching and price book) and show section + subtotal
  deltas (absolute and %), lines missing/extra, and labour hours delta.
- Ingest 6427 as holdout via the UI and run the comparison with the demo brief.
- "How this was built" panel on the draft: matches used, rate card, ratio estimates.
- Polish: loading states for AI steps, empty states, consistent design (read the
  frontend-design guidance if available), responsive layout.
- Deploy to Vercel and give me a demo checklist.

Report the 6427 comparison honestly. If a section is off by more than 25%, explain
why from the provenance and suggest the smallest fix. Don't tune rules to 6427
specifically.
```

---

## Useful follow-up prompts
- "Re-run the seed and show any job that doesn't reconcile, with the exact rows causing the gap."
- "The estimator says the install rate is $X and CONS is Y per day. Update the rate card and CONS logic, re-derive labour standards, and re-run the 6427 comparison."
- "Add N new expanded exports from /seed/docs/batch2 and show me how the 6427 comparison changes."
