import type { KJob, LabourStandard, PartRecord, SectionProfile } from "@/lib/knowledge/types";
import type { RateCardEntry } from "@/lib/ingest/types";
import type { MatchResult } from "@/lib/match/score";

/** Everything the deterministic draft builder needs. Loaded from the DB in the app, or derived from seed/out in scripts. */
export type DraftContext = {
  parts: PartRecord[];
  standards: LabourStandard[];
  profiles: SectionProfile[];
  rateCard: RateCardEntry[];
  matches: MatchResult[];
  /** Full data of the matched jobs (for text drafting and candidate parts). */
  matchedJobs: KJob[];
  /** Library jobs with per-item labour detail, i.e. where the labour standards came from. */
  labourSourceJobs?: string[];
};
