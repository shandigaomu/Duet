"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { href: "/journal", label: "时间线", match: (p: string) => p === "/journal" },
  {
    href: "/journal/days",
    label: "日子",
    match: (p: string) => p.startsWith("/journal/days"),
  },
] as const;

export function JournalSectionTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-3 flex flex-wrap gap-1">
      {SECTIONS.map((s) => {
        const active = s.match(pathname);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              "rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-white/70 text-brand shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]"
                : "text-ink-secondary hover:bg-white/35 hover:text-ink",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
