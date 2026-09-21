"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rebuildKnowledgeAction } from "@/app/(app)/price-book/actions";

export function RebuildButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => start(async () => setMsg(await rebuildKnowledgeAction()))}
      >
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Rebuild from library
      </Button>
      {msg && <p className={`text-xs ${msg.ok ? "text-muted-foreground" : "text-destructive"}`}>{msg.message}</p>}
    </div>
  );
}
