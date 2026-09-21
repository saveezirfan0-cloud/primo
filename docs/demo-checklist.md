# Demo checklist (about 10 minutes)

Before the demo
- [ ] Vercel deployment is green and `DEMO_PASSWORD`, Supabase, Anthropic and Voyage keys are set.
- [ ] Library shows 6570 (rev 2, labour detail), 6401 and 6521. 6427 shows the **holdout** badge.
- [ ] Price Book shows about 50 parts. Click **Rebuild from library** once so embeddings exist (needs the Voyage key).
- [ ] Open New Estimate → **Use the demo brief** → Parse brief → Generate draft → pick **6427** under
      "Compare against holdout job" → Save. Keep this estimate open in a tab as a fallback.

Walkthrough
1. **Library** (1 min): three jobs with totals and sections. Open 6570: expanded BOM tree, derived hours per item.
2. **Live ingestion** (2 min): Upload → re-upload the 6521 PDF. Show the arithmetic check reconciling to
   $69,185.90, then Discard (or Confirm to create revision 2).
3. **Price book & rate card** (1 min): latest prices, hours per part, category medians; the rate card is editable.
4. **New estimate** (2 min): paste the brief, show the parsed spec (edit a quantity), the top matches with score
   breakdown and reasons.
5. **Draft** (2 min): sections, provenance badges (price book / rate card / ratio estimate), hours × rate, live
   totals when a quantity changes, drafted scope / assumptions / exclusions, CSV export.
6. **Draft vs Actual** (1 min): section and subtotal deltas against the real $31,993.40; missing/extra lines;
   "How this was built" panel.
7. **Close**: accuracy scales with data; next step is 20–30 expanded exports straight from AroFlo.

Known limits to say out loud
- Non-expanded PDFs give no per-item labour, so overheads for those templates are ratio estimates.
- The rate card is a hypothesis from one job until the estimator confirms it.
- CONS and FREIGHT are ratio estimates rounded to $110 units.
