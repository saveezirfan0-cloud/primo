import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RebuildButton } from "@/components/knowledge/rebuild-button";
import { supabaseConfigured } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatAud } from "@/lib/utils";
import type { LabourStandardRow, PartRow } from "@/lib/supabase/types";

export const metadata = { title: "Price Book" };

async function load(q: string): Promise<{ parts: PartRow[]; standards: LabourStandardRow[]; error?: string }> {
  if (!supabaseConfigured()) return { parts: [], standards: [], error: "Supabase is not configured." };
  const db = supabaseAdmin();
  let query = db.from("parts").select("*").order("times_used", { ascending: false }).order("part_number").limit(300);
  if (q) query = query.or(`part_number.ilike.%${q}%,description.ilike.%${q}%,brand.ilike.%${q}%,category.ilike.%${q}%`);
  const [parts, standards] = await Promise.all([query, db.from("labour_standards").select("*")]);
  return { parts: parts.data ?? [], standards: standards.data ?? [], error: parts.error?.message ?? standards.error?.message };
}

export default async function PriceBookPage({ searchParams }: PageProps<"/price-book">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const { parts, standards, error } = await load(q);
  const stdByPart = new Map<string, LabourStandardRow[]>();
  for (const s of standards) {
    if (!s.part_number) continue;
    const arr = stdByPart.get(s.part_number) ?? [];
    arr.push(s);
    stdByPart.set(s.part_number, arr);
  }
  const categoryStd = standards.filter((s) => !s.part_number).sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.activity.localeCompare(b.activity));

  return (
    <>
      <PageHeader
        title="Price Book & Labour"
        description="Latest sell price per part number from the library, with hours per item where the expanded export gives them."
        actions={
          <div className="flex items-start gap-2">
            <Button asChild variant="outline">
              <Link href="/rate-card">Rate card</Link>
            </Button>
            <RebuildButton />
          </div>
        }
      />
      {error && <EmptyState title="Price book unavailable">{error}</EmptyState>}
      {!error && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Parts</CardTitle>
              <CardDescription>Built from non-OFE equipment lines of active library jobs. Latest price wins. Holdout jobs are excluded.</CardDescription>
              <form className="mt-2 flex max-w-md gap-2" action="/price-book">
                <Input name="q" placeholder="Search part, description, brand or category" defaultValue={q} />
                <Button type="submit" variant="secondary">Search</Button>
              </form>
            </CardHeader>
            <CardContent>
              {parts.length === 0 ? (
                <EmptyState title={q ? "No parts match" : "No parts yet"}>{q ? "Try another search." : "Click “Rebuild from library” after ingesting jobs."}</EmptyState>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Latest price</TableHead>
                      <TableHead className="text-right">Install</TableHead>
                      <TableHead>Used in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parts.map((p) => {
                      const inst = stdByPart.get(p.part_number)?.find((s) => s.activity === "INSTALL");
                      return (
                        <TableRow key={p.part_number}>
                          <TableCell className="font-mono text-xs">{p.part_number}</TableCell>
                          <TableCell className="max-w-[420px] whitespace-normal">
                            {p.brand && <span className="mr-1 text-muted-foreground">{p.brand}</span>}
                            {p.description}
                          </TableCell>
                          <TableCell><Badge variant="secondary">{p.category?.replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell className="text-right font-mono">{formatAud(p.last_price)}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">{inst ? `${Number(inst.hours)} h` : "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{(p.jobs ?? []).join(", ")}{p.last_seen ? ` · ${p.last_seen}` : ""}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Labour standards by category</CardTitle>
              <CardDescription>Median hours per unit (or dollars per item for DE-COMM) used when a part has no history of its own.</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryStd.length === 0 ? (
                <EmptyState title="No labour standards yet">They are derived from jobs with per-item labour detail (expanded exports).</EmptyState>
              ) : (
                <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {categoryStd.map((s) => (
                    <div key={`${s.category}-${s.activity}`} className="flex justify-between border-b py-1">
                      <span>
                        {s.category?.replace(/_/g, " ")} <span className="font-mono text-xs text-muted-foreground">{s.activity}</span>
                      </span>
                      <span className="font-mono">{Number(s.hours) > 0 ? `${Number(s.hours)} h` : formatAud(s.amount)}<span className="ml-1 text-xs text-muted-foreground">n={s.sample_count}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
