import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { jobFromPayload } from "./from-payload";
import type { KJob } from "./types";

/** Load KJobs from seed/out/*.json (no database). The expanded 6570 wins over its PDF. */
export function jobsFromSeedOut(dir = path.join(process.cwd(), "seed", "out")): KJob[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const byNumber = new Map<string, KJob>();
  for (const f of files.sort()) {
    const saved = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    if (!saved?.payload?.job_number) continue;
    const job = jobFromPayload(saved.payload);
    const prev = byNumber.get(job.job_number);
    if (!prev || (job.has_labour_detail && !prev.has_labour_detail)) byNumber.set(job.job_number, job);
  }
  return [...byNumber.values()];
}
