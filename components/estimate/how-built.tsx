import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Draft } from "@/lib/draft/types";
import { formatAud } from "@/lib/utils";

export function HowBuilt({ draft }: { draft: Draft }) {
  const counts = draft.sections.flatMap((s) => s.lines).reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.basis]: (acc[l.basis] ?? 0) + 1 }), {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>How this was built</CardTitle>
        <CardDescription>Claude decided what is in the job; code priced every line from the library.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="font-medium">Matches used</p>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {draft.matches.map((m) => <li key={m.job_number}><span className="font-mono">{m.job_number}</span> {m.title} — score {m.score.toFixed(2)}</li>)}
          </ul>
        </div>
        <div>
          <p className="font-medium">Line provenance</p>
          <p className="text-muted-foreground">{Object.entries(counts).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(" · ")}</p>
        </div>
        <div>
          <p className="font-medium">Rate card</p>
          <p className="font-mono text-xs text-muted-foreground">{draft.rate_card.filter((r) => r.unit === "hour" && r.rate).map((r) => `${r.code} ${formatAud(r.rate)}/h`).join(" · ")}</p>
        </div>
        <div>
          <p className="font-medium">Ratio estimates</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {draft.ratio_sources.map((r) => (
              <li key={r.section}>{r.section}: from {r.template} — cabling {(r.cabling_ratio * 100).toFixed(1)}%, consumables {(r.cons_ratio * 100).toFixed(1)}%, freight {(r.freight_ratio * 100).toFixed(1)}%, services {(r.services_ratio * 100).toFixed(0)}% of equipment value</li>
            ))}
          </ul>
        </div>
        {draft.warnings.length > 0 && (
          <div>
            <p className="font-medium">Warnings</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-400">{draft.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
