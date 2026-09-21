import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DbStatus } from "@/components/db-status";

const steps = [
  {
    href: "/library",
    title: "Library",
    description: "Past proposals with totals, sections and extracted cost drivers.",
  },
  {
    href: "/price-book",
    title: "Price Book & Labour",
    description: "Parts with their latest price, hours per item and the labour rate card.",
  },
  {
    href: "/estimates/new",
    title: "New Estimate",
    description: "Paste a short brief, review the spec and matches, then edit the draft.",
  },
];

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="Primo Estimator"
        description="Turns a short job brief into a draft estimate built from Primo's own past quotes."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="h-full transition-colors group-hover:border-foreground/40">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {s.title}
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>Checks that the app can reach its services.</CardDescription>
        </CardHeader>
        <CardContent>
          <DbStatus />
        </CardContent>
      </Card>
    </>
  );
}
