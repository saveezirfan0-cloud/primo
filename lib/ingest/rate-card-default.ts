import type { RateCardEntry } from "./types";

/** Mirror of the rate_card seed in supabase/migrations; used when the DB is unreachable. */
export const DEFAULT_RATE_CARD: RateCardEntry[] = [
  { code: "INSTALL", rate: 95.1, unit: "hour" },
  { code: "CABLING-INSTALL", rate: 95.1, unit: "hour" },
  { code: "DE-COMM", rate: null, unit: "item" },
  { code: "RACK-BUILD", rate: 95.1, unit: "hour" },
  { code: "ENGINEER", rate: 138, unit: "hour" },
  { code: "DOCUMENT", rate: 138, unit: "hour" },
  { code: "COMMISSION", rate: 138, unit: "hour" },
  { code: "TRAIN", rate: 138, unit: "hour" },
  { code: "O&M", rate: 138, unit: "hour" },
  { code: "PROGRAM", rate: 144, unit: "hour" },
  { code: "WORKSHOP", rate: 144, unit: "hour" },
  { code: "PROJECT-MANAGE", rate: 156, unit: "hour" },
  { code: "RUBBISH", rate: null, unit: "item" },
  { code: "EWASTE", rate: null, unit: "item" },
  { code: "PARKING", rate: null, unit: "item" },
  { code: "TRAVEL+ACCOMM", rate: null, unit: "item" },
  { code: "ACCESS", rate: null, unit: "item" },
];
