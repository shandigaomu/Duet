"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/us", label: "总览", exact: true },
  { href: "/us/lists", label: "清单" },
  { href: "/us/album", label: "相册" },
  { href: "/us/notes", label: "悄悄话" },
  { href: "/us/letters", label: "时光信" },
];

/** 时光信页顶部的「我们」二级导航（与清单/相册同款样式） */
export function LettersViewTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-[10px] px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-white/70 text-brand shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]"
                : "text-ink-secondary hover:bg-white/35 hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
