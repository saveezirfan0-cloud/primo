import { AppShell } from "@/components/app-shell";

// Every page in the app reads live data from Supabase; never prerender them.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
