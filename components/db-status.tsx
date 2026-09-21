import { Badge } from "@/components/ui/badge";
import { hasEnv, supabaseConfigured } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

type Check = { label: string; ok: boolean; detail: string };

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  if (!supabaseConfigured()) {
    checks.push({ label: "Supabase", ok: false, detail: "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set" });
  } else {
    try {
      const { count, error } = await supabaseAdmin().from("rate_card").select("*", { count: "exact", head: true });
      if (error) throw error;
      checks.push({
        label: "Supabase",
        ok: (count ?? 0) > 0,
        detail: (count ?? 0) > 0 ? `connected · rate_card has ${count} rows` : "connected, but rate_card is empty — apply migrations",
      });
    } catch (e) {
      checks.push({ label: "Supabase", ok: false, detail: e instanceof Error ? e.message : "connection failed" });
    }
  }

  checks.push({ label: "Anthropic", ok: hasEnv("ANTHROPIC_API_KEY"), detail: hasEnv("ANTHROPIC_API_KEY") ? "key present" : "ANTHROPIC_API_KEY not set" });
  checks.push({
    label: "Voyage embeddings",
    ok: hasEnv("VOYAGE_API_KEY"),
    detail: hasEnv("VOYAGE_API_KEY") ? "key present" : "VOYAGE_API_KEY not set — matching falls back to full-text search",
  });
  checks.push({ label: "Password gate", ok: hasEnv("DEMO_PASSWORD"), detail: hasEnv("DEMO_PASSWORD") ? "enabled" : "DEMO_PASSWORD not set — gate is open" });
  return checks;
}

export async function DbStatus() {
  const checks = await runChecks();
  return (
    <ul className="divide-y text-sm">
      {checks.map((c) => (
        <li key={c.label} className="flex items-center justify-between gap-4 py-2">
          <span className="font-medium">{c.label}</span>
          <span className="flex items-center gap-2 text-right text-muted-foreground">
            <span className="truncate">{c.detail}</span>
            <Badge variant={c.ok ? "success" : "warning"}>{c.ok ? "OK" : "Check"}</Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}
