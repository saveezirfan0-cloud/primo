/**
 * Hand-written Database types mirroring supabase/migrations.
 * Regenerate with `npx supabase gen types typescript --linked > lib/supabase/types.ts`
 * once the project is linked, if you prefer generated types.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type JobRow = {
  id: string;
  job_number: string;
  revision: number;
  title: string;
  client_org: string | null;
  site_suburb: string | null;
  issued_on: string | null;
  status: string;
  structure: string | null;
  room_type: string | null;
  install_type: string | null;
  subtotal_ex_gst: number | null;
  params: Json;
  scope_text: string | null;
  assumptions: string[];
  exclusions: string[];
  has_labour_detail: boolean;
  is_holdout: boolean;
  embedding: string | null;
  fts: unknown;
  created_at: string;
};

export type SectionRow = {
  id: string;
  job_id: string;
  name: string;
  kind: string;
  sort: number;
  total: number | null;
};

export type LineItemRow = {
  id: string;
  section_id: string;
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

export type OptionalItemRow = {
  id: string;
  job_id: string;
  description: string;
  part_number: string | null;
  qty: number;
  unit_price: number | null;
  total: number | null;
  sort: number;
};

export type DocumentRow = {
  id: string;
  job_id: string | null;
  kind: string;
  storage_path: string;
  file_name: string;
  extraction: Json | null;
  validation: Json | null;
  status: string;
  created_at: string;
};

export type PartRow = {
  part_number: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  last_price: number | null;
  last_seen: string | null;
  times_used: number;
  updated_at: string;
};

export type RateCardRow = {
  code: string;
  label: string;
  rate: number | null;
  unit: string;
  notes: string | null;
  updated_at: string;
};

export type LabourStandardRow = {
  id: string;
  part_number: string | null;
  category: string | null;
  activity: string;
  hours: number;
  sample_count: number;
  updated_at: string;
};

export type EstimateRow = {
  id: string;
  brief_text: string;
  spec: Json | null;
  matches: Json | null;
  draft: Json | null;
  compare_job_number: string | null;
  totals: Json | null;
  created_at: string;
  updated_at: string;
};

export type MatchJobsResult = {
  job_id: string;
  job_number: string;
  revision: number;
  title: string;
  score: number;
  score_params: number;
  score_vector: number;
  score_parts: number;
  reasons: string[];
};

export type Database = {
  public: {
    Tables: {
      jobs: Table<JobRow, "job_number" | "title">;
      sections: Table<SectionRow, "job_id" | "name">;
      line_items: Table<LineItemRow, "section_id" | "grp" | "description">;
      optional_items: Table<OptionalItemRow, "job_id" | "description">;
      documents: Table<DocumentRow, "kind" | "storage_path" | "file_name">;
      parts: Table<PartRow, "part_number">;
      rate_card: Table<RateCardRow, "code" | "label">;
      labour_standards: Table<LabourStandardRow, "activity" | "hours">;
      estimates: Table<EstimateRow, "brief_text">;
    };
    Views: Record<string, never>;
    Functions: {
      match_jobs: {
        Args: {
          p_spec: Json;
          p_embedding?: string | null;
          p_room_type?: string | null;
          p_limit?: number;
        };
        Returns: MatchJobsResult[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
