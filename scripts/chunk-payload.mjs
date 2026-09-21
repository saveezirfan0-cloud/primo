// Split a seed/out/*.json payload into staged INSERT statements (one per line).
//   node scripts/chunk-payload.mjs seed/out/X.json KEY [chunkBytes]
import { readFileSync, writeFileSync } from "node:fs";
const [file, key, size = "16000"] = process.argv.slice(2);
const json = JSON.stringify(JSON.parse(readFileSync(file, "utf8")).payload);
const n = Number(size);
const lines = [];
for (let i = 0, seq = 0; i < json.length; i += n, seq++) {
  const chunk = json.slice(i, i + n);
  if (chunk.includes("$q$")) throw new Error("chunk contains the quote tag");
  lines.push(`insert into public.ingest_staging(key, seq, chunk) values ('${key}', ${seq}, $q$${chunk}$q$);`);
}
const out = file.replace(/\.json$/, `.${key}.chunks.sql`);
writeFileSync(out, lines.join("\n") + "\n");
console.log(`${out}: ${lines.length} chunks, ${json.length} bytes`);
