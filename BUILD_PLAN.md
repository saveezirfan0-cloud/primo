# Primo Estimator — Demo Build Plan

## Demo goal
Show Nof, on his own data, that a short job brief produces:
1. the most similar past jobs, with reasons, and
2. a draft estimate in Primo's own format (Video / Audio / Control sections, equipment, cabling, consumables, freight, labour), with scope text, assumptions and exclusions,

...and that the draft lands close to what his estimator actually quoted.

## The holdout test (the core of the demo)
- **Library:** 6570 (expanded .docx, plus its PDF as the same job), 6401, 6521.
- **Holdout:** 6427 (Mount Pritchard East PS). It's the near-twin of 6570, and 6570 has full labour detail.
- Type a 6427-style brief into the app, generate a draft, then show **Draft vs Actual** side by side against the real $31,993.40.
- Target: subtotal within ±15%, each section within ±25%. Whatever the result, show it honestly. The per-line provenance explains the gaps, and the gaps make the case for loading more jobs.

Sample brief for the demo (write it in plain estimator language):
> School hall upgrade, Mount Pritchard East PS. Replace the old projector with a ~6,500 lm laser projector on a new ceiling pole; keep the existing motorised screen and add relay control. Two HDMI inputs, one at the stage and one at the rack, with auto-switching. Keep the existing speakers and amps. New DSP, 3 wireless mics (2 handheld + 1 wireless lectern gooseneck) with remote antennas, Bluetooth input in the rack. Small touch panel in the rack for control. Reuse the existing rack. Split pricing into Video / Audio / Control so the school can stage it. EWP needed. Remove DVD/CD players.

## Demo walkthrough (about 10 minutes)
1. **Library:** 3 jobs with totals, sections, and extracted params.
2. **Live ingestion:** upload one PDF live (for example re-upload 6521). Show extraction, then the arithmetic check passing ("reconciles to $69,185.90"), then saving.
3. **Price book & labour standards:** parts with latest prices; hours per item and the rate card derived from 6570.
4. **New estimate:** paste the brief. Show the parsed spec (editable), then the top matches with a score breakdown.
5. **Draft:** sections, lines with provenance badges, labour as hours × rate, editable quantities and prices with live totals, and drafted scope / assumptions / exclusions.
6. **Draft vs Actual:** the comparison view against 6427.
7. **Close:** "Accuracy scales with data. Next step is loading expanded exports of 20–30 past jobs, ideally straight from AroFlo."

## Phases

### Phase 0 — Scaffold (about 3 hrs)
- Next.js app, Tailwind, shadcn/ui, Supabase client (server + browser), password middleware.
- Migrations: tables below, pgvector extension, private storage bucket, `match_jobs` SQL function stub.
- Vercel deploy of the empty shell.

**Done when:** the app deploys, the password gate works, and migrations are applied.

### Phase 1 — Ingestion & validation (about 8 hrs)
- Upload a PDF or .docx, store it in Storage, and create a `documents` row.
- Text prep: truncate at "Acceptance & Payment". For .docx, use mammoth to HTML to keep table structure. For PDFs, send the PDF to Claude directly.
- Claude extraction with a strict schema covering: job header, sections, line items (with a `parent_ref` for the expanded tree), optional items, params, scope paragraphs, assumptions, exclusions.
- Post-processing in code:
  - Infer the tree from sums in expanded exports.
  - Tag labour lines with activity codes.
  - Derive `hours = total / rate` where a rate from the rate card fits within tolerance.
- **Arithmetic validation:** lines reconcile to sections, and sections to the subtotal. Show a pass/fail report.
- Review screen with the extracted JSON beside the rendered sections. Save to the DB only on confirm.
- Seed script: ingest the 4 library documents from `/seed/docs` (not 6427).

**Done when:** all library docs reconcile, or show clearly why not, and 6570's labour lines have hours.

### Phase 2 — Knowledge layer & matching (about 5 hrs)
- **Price book:** upsert `parts` from all non-OFE equipment lines, keeping the latest price and a usage count.
- **Rate card:** seed from the hypothesis in CLAUDE.md, and make it editable in the UI.
- **Labour standards:** hours per part number per activity (INSTALL, DE-COMM, CABLING-INSTALL), plus per-category medians as a fallback, plus section-level overhead hours (ENGINEER, COMMISSION, PM, …) against section equipment value.
- **Embeddings:** embed title + scope + a params summary per job.
- **`match_jobs(spec, embedding)`** combines:
  - params similarity (weighted),
  - vector similarity,
  - part-number or category overlap,
  - a room_type filter.

  It returns the top 3 with per-component scores.

**Done when:** the demo brief returns 6570 as the top match with sensible reasons.

### Phase 3 — Draft generation (about 7 hrs)
1. **Brief to spec:** Claude turns the free text into a component spec: sections, components with qty, new vs retained, and params. The user can edit it in a form.
2. **Spec to lines (deterministic TypeScript):**
   - **Equipment:**
     - Map each component to a part from the price book. Claude picks among candidate parts drawn from matched jobs; code does the lookup and pricing.
     - Retained items become OFE lines at $0.
   - **Labour:**
     - Per-item INSTALL and DE-COMM hours come from the standards; CABLING-INSTALL from matched-job ratios; section overheads from the nearest match.
     - Multiply by the rate card.
     - Output uses Primo's activity codes.
   - **CABLING, CONS, FREIGHT:** ratio to section equipment value, taken from the best-matching section. Label these `ratio_estimate`.
3. **Text:** Claude drafts scope paragraphs, assumptions and exclusions by adapting matched jobs' text to the spec. It must not invent equipment that isn't in the lines.
4. **Draft UI:** sections with an editable table, provenance badges, confidence colouring, and live totals (ex GST, GST 10%, inc GST).
5. **Export:** CSV in Primo's BOM column order (Item, Part, Quantity, Price Each, Price Total).

**Done when:** the demo brief produces a complete draft in about 60 seconds or less.

### Phase 4 — Demo polish (about 4 hrs)
- **Draft vs Actual view** for any estimate linked to a holdout job number: section and subtotal deltas, and lines missing or extra.
- **"How this was built" panel** listing the matches used, the rate card, and the ratio estimates.
- Loading states, empty states, a clean visual style, mobile-safe layout.
- Rehearse the walkthrough end to end on the deployed Vercel URL.

**Total: about 27 hrs (3–4 working days).**

## Data model (demo)
```
jobs(id, job_number, revision, title, client_org, site_suburb, issued_on, status,
     structure, room_type, install_type, subtotal_ex_gst, params jsonb,
     scope_text, assumptions text[], exclusions text[], has_labour_detail bool,
     is_holdout bool, embedding vector(1024), fts tsvector, created_at)
sections(id, job_id, name, kind, sort, total)
line_items(id, section_id, parent_id, grp, code, part_number, description,
           qty, unit_price, total, is_existing bool, activity, hours, rate, sort)
optional_items(id, job_id, description, part_number, qty, unit_price, total)
documents(id, job_id, kind, storage_path, file_name, extraction jsonb,
          validation jsonb, status)
parts(part_number pk, description, brand, category, last_price, last_seen, times_used)
rate_card(code pk, label, rate, unit, notes)
labour_standards(id, part_number null, category null, activity, hours, sample_count)
estimates(id, brief_text, spec jsonb, matches jsonb, draft jsonb,
          compare_job_number, totals jsonb, created_at)
```

## Out of scope for the demo
AroFlo integration, user accounts and roles, schematic parsing (store files only), cost and margin (the proposals show sell prices only), branded PDF proposal output, and bulk backfill tooling.

## Questions to confirm with Nof / the estimator after the demo
1. Can AroFlo export expanded quotes in bulk (API or CSV)? How many past jobs are available?
2. Are the rate card and CONS/FREIGHT logic right?
3. Should the tool output a priced BOM only, or the full proposal text too?
4. Do they want cost and margin tracked, which needs cost data from AroFlo?
