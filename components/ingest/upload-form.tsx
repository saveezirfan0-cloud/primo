"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UploadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a PDF or .docx proposal first.");
      return;
    }
    setBusy(true);
    setStage("Uploading and extracting with Claude. This usually takes 30–90 seconds…");
    try {
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const isJson = res.headers.get("content-type")?.includes("application/json") ?? false;
      if (!isJson) {
        if (res.status === 413) throw new Error("That file is too large for the upload endpoint (limit about 4.5 MB). Try the PDF export, or a smaller file.");
        if (res.status === 504) throw new Error("Extraction timed out. Try again; long documents can take a couple of minutes.");
        throw new Error(`Upload failed (${res.status}).`);
      }
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Upload failed.");
      setStage("Extracted. Opening the review screen…");
      router.push(`/documents/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setBusy(false);
      setStage("");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">Proposal file</Label>
        <Input id="file" name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} />
        <p className="text-xs text-muted-foreground">PDF or Word export from AroFlo. Expanded exports give the best data.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {stage && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {stage}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <UploadCloud />}
        Upload and extract
      </Button>
    </form>
  );
}
