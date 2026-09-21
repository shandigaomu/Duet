"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, SunMedium, UserRound } from "lucide-react";
import { MAIN_NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";

const ICONS = {
  "/today": SunMedium,
  "/journal": BookOpen,
  "/me": UserRound,
} as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-30 md:hidden"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
      aria-label="底部导航"
    >
      <ul className="glass-nav mx-auto flex h-[var(--bottom-nav-h)] max-w-[var(--content-max)] items-stretch rounded-[var(--radius-xl)] px-2">
        {MAIN_NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = ICONS[item.href as keyof typeof ICONS];
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-medium tracking-[0.04em] transition-[color,transform,background] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  active ? "bg-white/55 text-brand" : "text-ink-secondary",
                )}
              >
                <Icon
                  className={cn(
                    "size-[20px] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    active && "scale-110",
                  )}
                  strokeWidth={active ? 2 : 1.6}
                  aria-hidden
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
