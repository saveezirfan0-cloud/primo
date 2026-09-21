/** Plain-data views of jobs used by the knowledge layer, matching and drafting. */

export type KJob = {
  id: string;
  job_number: string;
  revision: number;
  title: string;
  client_org: string | null;
  site_suburb: string | null;
  issued_on: string | null;
  structure: string | null;
  room_type: string | null;
  install_type: string | null;
  subtotal_ex_gst: number | null;
  params: Record<string, unknown>;
  scope_text: string | null;
  assumptions: string[];
  exclusions: string[];
  has_labour_detail: boolean;
  is_holdout: boolean;
  embedding: number[] | null;
  sections: KSection[];
};

export type KSection = {
  id: string;
  name: string;
  kind: string;
  sort: number;
  total: number | null;
  lines: KLine[];
};

export type KLine = {
  id: string;
  parent_id: string | null;
  grp: string;
  code: string | null;
  part_number: string | null;
  description: string;
  qty: number;
  unit_price: number | null;
  total: number | null;
  is_existing: boolean;
  activity: string | null;
  hours: number | null;
  rate: number | null;
  sort: number;
};

export type PartRecord = {
  part_number: string;
  description: string;
  brand: string | null;
  category: string;
  last_price: number;
  last_seen: string | null;
  times_used: number;
  jobs: string[]; // job numbers
};

export type LabourStandard = {
  part_number: string | null;
  category: string | null;
  activity: string;
  hours: number; // hours per unit (0 for dollar-per-item activities)
  amount: number | null; // dollars per unit for non-hourly activities (DE-COMM)
  sample_count: number;
};

/** Section-level figures from a real job, used as templates for overheads and ratios. */
export type SectionProfile = {
  job_number: string;
  job_title: string;
  section_name: string;
  section_kind: string;
  section_total: number;
  equipment_value: number; // sum of leaf EQUIPMENT lines (non-OFE)
  cabling: number;
  cons: number;
  freight: number;
  services: number;
  /** Per activity: hours (when derivable) and dollars. */
  activities: Record<string, { hours: number | null; amount: number }>;
  categories: string[]; // categories of equipment in this section
};
