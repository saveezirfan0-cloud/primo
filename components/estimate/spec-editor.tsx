"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { COMPONENT_CATEGORIES, type Spec, type SpecComponent } from "@/lib/schemas/spec";
import type { MatchResult } from "@/lib/match/score";
import { updateSpecAction, generateDraftAction } from "@/app/(app)/estimates/actions";
import { useRouter } from "next/navigation";

export function SpecEditor({ id, initial, initialMatches, hasDraft }: { id: string; initial: Spec; initialMatches: MatchResult[]; hasDraft: boolean }) {
  const router = useRouter();
  const [spec, setSpec] = useState<Spec>(initial);
  const [matches, setMatches] = useState<MatchResult[]>(initialMatches);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [generating, startGen] = useTransition();

  const update = (next: Spec) => {
    setSpec(next);
    setDirty(true);
  };
  const setComp = (ref: string, patch: Partial<SpecComponent>) => update({ ...spec, components: spec.components.map((c) => (c.ref === ref ? { ...c, ...patch } : c)) });
  const removeComp = (ref: string) => update({ ...spec, components: spec.components.filter((c) => c.ref !== ref) });
  const addComp = (section_ref: string) => {
    const n = spec.components.length + 1;
    update({ ...spec, components: [...spec.components, { ref: `C${n}-${Date.now().toString(36)}`, section_ref, category: "other", description: "", qty: 1, status: "new", part_hint: "", notes: "" }] });
  };

  const save = () =>
    startSave(async () => {
      const r = await updateSpecAction(id, spec);
      setMsg(r.ok ? "Spec saved and matches refreshed." : r.message ?? "Save failed");
      if (r.ok && r.matches) {
        setMatches(r.matches);
        setDirty(false);
      }
    });
  const generate = () =>
    startGen(async () => {
      if (dirty) {
        const r = await updateSpecAction(id, spec);
        if (!r.ok) {
          setMsg(r.message ?? "Save failed");
          return;
        }
        setDirty(false);
      }
      const r = await generateDraftAction(id);
      setMsg(r.ok ? null : r.message ?? "Generation failed");
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-muted-foreground">Title</span>
          <Input value={spec.title} onChange={(e) => update({ ...spec, title: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Room</span>
          <select className="mt-1 h-9 w-full rounded-md border bg-transparent px-2 text-sm" value={spec.room_type} onChange={(e) => update({ ...spec, room_type: e.target.value as Spec["room_type"] })}>
            {["hall", "auditorium", "classroom", "library", "gym", "other"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={spec.ewp_required} onChange={(e) => update({ ...spec, ewp_required: e.target.checked })} /> EWP required
        </label>
      </div>

      {spec.sections.map((s) => (
        <div key={s.ref} className="rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
            <Input className="h-8 max-w-xs border-0 bg-transparent px-0 font-medium shadow-none" value={s.name} onChange={(e) => update({ ...spec, sections: spec.sections.map((x) => (x.ref === s.ref ? { ...x, name: e.target.value } : x)) })} />
            <Button type="button" size="sm" variant="ghost" onClick={() => addComp(s.ref)}><Plus /> Component</Button>
          </div>
          <div className="divide-y">
            {spec.components.filter((c) => c.section_ref === s.ref).map((c) => (
              <div key={c.ref} className="grid grid-cols-[90px_1fr_60px_150px_32px] items-center gap-2 px-3 py-1.5 text-sm">
                <select className="h-8 rounded-md border bg-transparent px-1 text-xs" value={c.status} onChange={(e) => setComp(c.ref, { status: e.target.value as SpecComponent["status"] })}>
                  <option value="new">new</option>
                  <option value="retained">retained</option>
                  <option value="remove">remove</option>
                </select>
                <Input className="h-8" value={c.description} onChange={(e) => setComp(c.ref, { description: e.target.value })} />
                <Input className="h-8 text-right" type="number" min={0} value={c.qty} onChange={(e) => setComp(c.ref, { qty: Number(e.target.value) })} />
                <select className="h-8 rounded-md border bg-transparent px-1 text-xs" value={c.category} onChange={(e) => setComp(c.ref, { category: e.target.value })}>
                  {COMPONENT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>)}
                </select>
                <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeComp(c.ref)} aria-label="Remove"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">Closest past jobs</p>
        <ul className="space-y-2 text-sm">
          {matches.map((m, i) => (
            <li key={m.job_number}>
              <div className="flex items-center justify-between">
                <span>
                  <Badge variant={i === 0 ? "default" : "secondary"} className="mr-2">{i + 1}</Badge>
                  <span className="font-mono">{m.job_number}</span> {m.title}
                </span>
                <span className="font-mono text-xs">score {m.score.toFixed(2)} · params {m.score_params.toFixed(2)} · scope {m.score_vector.toFixed(2)} · parts {m.score_parts.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{m.reasons.join(" · ")}</p>
            </li>
          ))}
          {matches.length === 0 && <li className="text-muted-foreground">No library jobs to match against yet.</li>}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={save} disabled={saving || generating}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save spec & re-match
        </Button>
        <Button type="button" onClick={generate} disabled={saving || generating}>
          {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {generating ? "Pricing lines and drafting text (about a minute)…" : hasDraft ? "Regenerate draft" : "Generate draft"}
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
