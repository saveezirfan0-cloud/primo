import { Badge } from "@/components/ui/badge";
import type { Basis, Confidence } from "@/lib/draft/types";

const BASIS_LABEL: Record<Basis, string> = {
  price_book: "price book",
  matched_job: "matched job",
  rate_card: "rate card",
  ratio_estimate: "ratio estimate",
  ai_guess: "needs price",
};

export function ProvenanceBadge({ basis, confidence, source, note }: { basis: Basis; confidence: Confidence; source: string | null; note: string }) {
  const variant = confidence === "high" ? "success" : confidence === "medium" ? "secondary" : "warning";
  return (
    <span title={`${note}${source ? ` (source: ${source})` : ""}`} className="inline-flex items-center gap-1">
      <Badge variant={variant} className="font-normal">
        {BASIS_LABEL[basis]}
        {source ? ` · ${source}` : ""}
      </Badge>
    </span>
  );
}
