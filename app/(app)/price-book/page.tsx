import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabaseConfigured } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatAud } from "@/lib/utils";
import type { PartRow, RateCardRow } from "@/lib/supabase/types";

export const metadata = { title: "Price Book" };

async function load(): Promise<{ parts: PartRow[]; rates: RateCardRow[]; error?: string }> {
  if (!supabaseConfigured()) return { parts: [], rates: [], error: "Supabase is not configured." };
  const db = supabaseAdmin();
  const [parts, rates] = await Promise.all([
    db.from("parts").select("*").order("times_used", { ascending: false }).limit(200),
    db.from("rate_card").select("*").order("code"),
  ]);
  const error = parts.error?.message ?? rates.error?.message;
  return { parts: parts.data ?? [], rates: rates.data ?? [], error };
}

export default async function PriceBookPage() {
  const { parts, rates, error } = await load();

  return (
    <>
      <PageHeader title="Price Book & Labour" description="Latest sell price per part number, and the hourly rate card." />
      {error && <EmptyState title="Price book unavailable">{error}</EmptyState>}

      {!error && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Parts</CardTitle>
              <CardDescription>Built from non-OFE equipment lines. Latest price wins.</CardDescription>
            </CardHeader>
            <CardContent>
              {parts.length === 0 ? (
                <EmptyState title="No parts yet">The price book is built from ingested jobs in Phase 2.</EmptyState>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Latest price</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parts.map((p) => (
                      <TableRow key={p.part_number}>
                        <TableCell className="font-mono">{p.part_number}</TableCell>
                        <TableCell className="whitespace-normal">{p.description}</TableCell>
                        <TableCell className="text-right font-mono">{formatAud(p.last_price)}</TableCell>
                        <TableCell className="text-right">{p.times_used}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate card</CardTitle>
              <CardDescription>Hourly sell rates by activity. Hypothesis from job 6570; verify with the estimator.</CardDescription>
            </CardHeader>
            <CardContent>
              {rates.length === 0 ? (
                <EmptyState title="Rate card empty">Apply the migrations to seed it.</EmptyState>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((r) => (
                      <TableRow key={r.code}>
                        <TableCell>
                          <div className="font-mono">{r.code}</div>
                          <div className="text-xs text-muted-foreground">{r.label}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {r.unit === "hour" ? `${formatAud(r.rate)}/h` : "per item"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
