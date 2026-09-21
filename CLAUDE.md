# Primo Estimator — Project Context

## What we're building
An internal app for **Primo Group Services Pty Ltd** (Prestons, NSW, Australia), an AV integrator. It stores past quotes (proposals) and uses them to generate a close starting estimate for a new job from a short brief. Their estimator currently spends up to ~2 days per quote. The owner (Nof) wants to type in requirements and get a draft back that the estimator adjusts.

**Current goal: a DEMO for Nof, not a production system.** Optimise for a convincing, honest, end-to-end demo on real Primo data. Keep the architecture clean enough to extend later, but don't build production features (roles, multi-tenant, AroFlo sync, billing).

## Domain: how Primo quotes work (learned from 5 sample documents)

### Jobs
All 4 sample jobs are NSW Department of Education school halls/auditoriums (AV upgrades):

| Job | Project | Structure | Subtotal ex GST (AUD) |
|---|---|---|---|
| 6427 | Mount Pritchard East PS – Hall Upgrade | Sections: Video / Audio / Control | $31,993.40 |
| 6570 | Eastwood Heights PS – Hall Upgrade | Sections: Video / Audio / Control | $57,651.60 |
| 6401 | Colyton HS – Hall Upgrade | Stage 1 / Stage 2 / Stage 3 + optional item | $114,950.84 |
| 6521 | Sydney Tech HS – Auditorium AV Upgrade | Single section + 5 optional items | $69,185.90 |

6570 exists twice: a PDF (issued 14/8/2026) and an **expanded Word export** (re-issued 21/9/2026, same totals) that breaks every roll-up into its sub-items. Treat them as the same job (`job_number` + `revision`) and prefer the expanded one.

### Document structure (AroFlo-generated template, very consistent)
Cover → letter → **Scope of Works** (prose paragraphs, sometimes per stage) → Handover → **Summary Pricing** (section totals, subtotal, GST, total) → **Optional Items** (priced "+$") → **Detailed Bill of Materials** → **Notes & Assumptions** (bullets) → **Exclusions** (bullets) → Acceptance & Payment → Terms & Conditions.

**Ignore everything from "Acceptance & Payment" onward** (payment details + T&Cs). Never store bank details or client personal contact details beyond org name, contact name and suburb.

### Bill of Materials rules
- Grouped by **section** (a system like Video/Audio/Control, or a stage).
- Each section has **equipment lines** (item description, part number, qty, unit price, line total).
- `OFE` part = owner-furnished/existing equipment at $0 (retained on site). This is important context: it tells us what is being **kept vs replaced**.
- `CUSTOM` part = custom-fabricated item (brackets, road cases, lecterns).
- Every section ends with 4 roll-ups: `CABLING`, `CONS` (hardware & consumables), `FREIGHT`, `SERVICES` (labour).
- Small rounding drift between unit × qty and line total (e.g. $35,139.60 vs $35,139.31) is normal. Use a tolerance of ~$1 per line / ~$5 per section.

### Expanded export (6570 .docx) — the most valuable data
Roll-ups are broken into children. Parent rows are subtotals of their children, so **the tree can be inferred from sums**. Observed structure per section:

- `Equipment` → equipment + OFE lines
- `Cabling` → cable assemblies/materials (e.g. "Cat 6A F/UTP Dual Data Outlet – 20mtrs"), per-metre cable, connectors, labels, plus `Contingency`
- `Hardware & Consumables` (CONS), `Freight & Logistics` (FREIGHT)
- `Services` → labour activity children, each with its own children:
  - `DE-COMM` (per decommissioned item), `INSTALL` (per installed item), `CABLING-INSTALL` (per cable item/metre)
  - `RACK-BUILD`, `ENGINEER`, `DOCUMENT`, `COMMISSION`, `PROGRAM`, `TRAIN`, `O&M`, `PROJECT-MANAGE`, `RUBBISH`, `EWASTE`, `PARKING`, `TRAVEL+ACCOMM`, `ACCESS` (EWP/scissor lift hire), `WORKSHOP`
- Some bundles are broken out into their parts (e.g. the AirServer line appears once as the bundle and again as unit + power pack). Don't double count: children replace parents.

### Pricing insight: labour is hours × rate (HYPOTHESIS — verify with estimator)
SERVICES is ~40–57% of every quote. The expanded export shows labour values that are clean multiples of hourly sell rates:

| Activity | Apparent sell rate (AUD/hr) | Evidence |
|---|---|---|
| INSTALL, CABLING-INSTALL, DE-COMM* | ~95.10 | 47.55 = 0.5h, 57.06 = 0.6h, 190.20 = 2h/speaker, 9.51/m = 0.1h per metre |
| ENGINEER, DOCUMENT, COMMISSION, TRAIN, O&M | ~138 | 552 = 4h, 1656 = 12h, 103.50 = 0.75h |
| PROGRAM, WORKSHOP | ~144 | 1152 = 8h, 1728 = 12h, 288 = 2h |
| PROJECT-MANAGE | ~156 | 624 = 4h, 2496 = 16h |

*DE-COMM values (30.91, 61.82) don't divide cleanly by 95.10; treat DE-COMM as a dollar amount per item for now.

**Design consequence:** the estimator thinks in *hours per item/activity*. Store derived `hours` and `rate` on labour lines and generate labour as hours × rate from a `rate_card` table, not by copying dollar amounts.

`CONS` and `FREIGHT` values are clean multiples of a base unit that varies by quote ($110 on 6427/6570, $115 on 6401, $120 on 6521). Treat as a hypothesis; for the demo, estimate them as a ratio of section equipment value from the nearest match, and show that it's an estimate.

### Repeated equipment (price book opportunity)
Same part numbers recur across jobs (MIPRO ACT747 / ACT700H / AT90W / MS90, Yamaha MTX3 / PX5, AVPro Edge AC-CX42-AUHD, Extron 60-1993-02 / 60-1998-03 / 79-2577-01, TL-SG116P, GC-IP2CC-P, inDESIGN MMP-1). Prices drift slightly between quotes (AT90W $321.20 vs $335.80). Keep a `parts` price book with the **latest** price per part number.

### Cost drivers (params to extract per job)
room_type (hall/auditorium/classroom/…), install_type (upgrade/new), staged (bool), sections, projectors_new, projector_lumens, screens_new, screens_retained, speakers_new, speakers_retained, audio_zones (e.g. hall + COLA), amp_channels_new, wireless_mic_channels, wired_mics, dsp_new, dante (bool), stage_io (bool), touch_panels, control_processor (bool), video_inputs (count + locations), wireless_presentation (bool), rack (new|reuse, RU), hearing_augmentation (none|retain_integrate|new), lighting_integration (bool), recording_streaming (bool), ewp_required (bool), decomm_item_count, optional_items_count.

## Stack
- Next.js (App Router, TypeScript), Tailwind, shadcn/ui
- Supabase: Postgres + pgvector + Storage (bucket `documents`, private)
- Anthropic API via `@anthropic-ai/sdk`, model `claude-sonnet-5` for extraction and drafting, using tool use / JSON schema for structured output
- Embeddings: Voyage AI (`voyage-3.5` or current equivalent, 1024 dims). If `VOYAGE_API_KEY` is missing, fall back gracefully to Postgres full-text only.
- Zod for all schemas; `mammoth` for .docx; PDFs sent directly to Claude as document blocks
- Deploy: GitHub → Vercel. Repo must be **private** (client data).

## Conventions
- All AI calls server-side only (route handlers / server actions). Never expose keys to the client.
- All money in AUD ex GST, stored as `numeric(12,2)`.
- **LLM decides *what*, code decides *how much*.** Claude extracts specs and writes prose; deterministic TypeScript does quantities × prices × hours × rates and all totals.
- Every drafted line carries provenance: `source_job_number` + `basis` (`price_book` | `matched_job` | `rate_card` | `ratio_estimate` | `ai_guess`) + `confidence`.
- Validation by arithmetic: extracted line items must reconcile to section totals and the subtotal within tolerance. Anything that doesn't reconcile is flagged for review, not silently saved.
- Sample documents live in `/seed/docs` and are **gitignored**.
- Simple password gate via middleware (`DEMO_PASSWORD` env). No full auth for the demo.

## Environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
DEMO_PASSWORD=
```
