# Seed data

Put the sample Primo proposals in `seed/docs/` (gitignored, never commit client data):

- `Primo_Quote_JN6570__1_.docx` (expanded export)
- `Primo_Quote_JN6570_20260814.pdf`
- `Primo_Quote_JN6401_20260803.pdf`
- `Primo_Quote_JN6521_20260918.pdf`
- `Primo_Quote_JN6427_20260720.pdf` (holdout; the seed script never ingests it)

`npm run seed` (Phase 1) ingests the four library documents.
