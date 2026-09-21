import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabaseConfigured } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatAud } from "@/lib/utils";
import type { JobRow } from "@/lib/supabase/types";

export const metadata = { title: "Library" };

async function loadJobs(): Promise<{ jobs: JobRow[]; error?: string }> {
  if (!supabaseConfigured()) return { jobs: [], error: "Supabase is not configured." };
  const { data, error } = await supabaseAdmin()
    .from("jobs")
    .select("*")
    .order("job_number", { ascending: true })
    .order("revision", { ascending: false });
  if (error) return { jobs: [], error: error.message };
  return { jobs: data ?? [] };
}

export default async function LibraryPage() {
  const { jobs, error } = await loadJobs();

  return (
    <>
      <PageHeader
        title="Library"
        description="Past proposals ingested from AroFlo exports."
        actions={
          <Button asChild>
            <Link href="/upload"><UploadCloud /> Upload proposal</Link>
          </Button>
        }
      />
      {error ? (
        <EmptyState title="Library unavailable">{error}</EmptyState>
      ) : jobs.length === 0 ? (
        <EmptyState title="No jobs yet">
          <Link href="/upload" className="underline">Upload a proposal</Link> or run <code>npm run seed</code> to load the sample library.
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Structure</TableHead>
              <TableHead className="text-right">Subtotal ex GST</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="font-mono">
                  {j.job_number}
                  {j.revision > 1 && <span className="text-muted-foreground"> r{j.revision}</span>}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <Link href={`/jobs/${j.id}`} className="hover:underline">{j.title}</Link>
                </TableCell>
                <TableCell>{j.room_type ?? "—"}</TableCell>
                <TableCell>{j.structure ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">{formatAud(j.subtotal_ex_gst)}</TableCell>
                <TableCell className="space-x-1">
                  {j.has_labour_detail && <Badge variant="secondary">labour detail</Badge>}
                  {j.is_holdout && <Badge variant="outline">holdout</Badge>}
                  {j.status !== "active" && <Badge variant="outline">{j.status}</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
