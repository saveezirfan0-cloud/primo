import Link from "next/link";
import { LogOut } from "lucide-react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { gateEnabled } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                P
              </span>
              <span className="hidden sm:inline">Primo Estimator</span>
            </Link>
            <Nav />
          </div>
          {gateEnabled() && (
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
                <LogOut />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Primo Group Services · internal estimating demo · all prices AUD ex GST
      </footer>
    </div>
  );
}
