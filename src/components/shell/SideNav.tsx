"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="glass-nav fixed inset-y-4 left-4 z-30 hidden w-[var(--nav-width)] flex-col rounded-[var(--radius-xl)] px-5 py-6 md:flex">
      <Link
        href="/today"
        className="font-display text-[28px] leading-none tracking-[0.04em] text-brand transition-opacity hover:opacity-80"
      >
        Duet
      </Link>
      <p className="mt-2 text-[12px] text-ink-tertiary">私人空间 · 两人</p>

      <p className="mt-8 text-[11px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
        Spaces
      </p>
      <nav className="mt-3 flex flex-col gap-1" aria-label="主导航">
        {MAIN_NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "nav-link relative rounded-[12px] px-3 py-2.5 text-[14px] font-medium",
                active
                  ? "bg-white/70 text-brand shadow-[0_1px_0_rgba(255,255,255,0.55)_inset]"
                  : "text-ink-secondary hover:bg-white/30 hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[14px] bg-white/25 px-3 py-3 text-[12px] leading-relaxed text-ink-secondary">
        <p className="font-medium text-ink">今日工作台</p>
        <p className="mt-1">同步近况、翻记录、管理配对。</p>
      </div>
    </aside>
  );
}
