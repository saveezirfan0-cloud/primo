"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Clock3, FilePlus2, Library } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/library", label: "Library", icon: Library },
  { href: "/price-book", label: "Price Book", icon: BookOpen },
  { href: "/rate-card", label: "Rate Card", icon: Clock3 },
  { href: "/estimates/new", label: "New Estimate", icon: FilePlus2 },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
