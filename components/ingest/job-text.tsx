import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function JobText({ scope, assumptions, exclusions }: { scope: string | null; assumptions: string[]; exclusions: string[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle>Scope of works</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {(scope ?? "").split(/\n\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          {!scope && <p>—</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Notes &amp; assumptions</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Exclusions</CardTitle></CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{exclusions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </CardContent>
      </Card>
    </div>
  );
}
