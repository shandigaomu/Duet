"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { JournalSectionTabs } from "@/components/journal/JournalSectionTabs";
import {
  Workbench,
  WorkbenchTab,
  WorkbenchToolbar,
} from "@/components/shell/Workbench";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  formatDayShort,
  formatMonthHeading,
  type TimelineFilter,
  type TimelineItem,
  type TimelineStats,
} from "@/lib/journal";
import { MOOD_BY_ID, type MoodId } from "@/lib/checkin";

type JournalViewProps = {
  initialItems: TimelineItem[];
  stats: TimelineStats;
  partnerNickname: string;
  initialFilter?: TimelineFilter;
  initialMonth?: string;
  currentMonth: string;
  initialQuery?: string;
};

const FILTERS: { id: TimelineFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "mine", label: "我的" },
  { id: "yours", label: "你的" },
  { id: "week", label: "本周" },
  { id: "thisMonth", label: "本月" },
  { id: "month", label: "按月" },
];

export function JournalView({
  initialItems,
  stats,
  partnerNickname,
  initialFilter = "all",
  initialMonth,
  currentMonth,
  initialQuery = "",
}: JournalViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<TimelineFilter>(initialFilter);
  const [month, setMonth] = useState(initialMonth || currentMonth);
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  function pushParams(
    next: TimelineFilter,
    nextMonth = month,
    nextQ = query,
  ) {
    setFilter(next);
    startTransition(() => {
      const params = new URLSearchParams();
      if (next !== "all") params.set("filter", next);
      if (next === "month") params.set("month", nextMonth);
      const q = nextQ.trim();
      if (q) params.set("q", q);
      const qs = params.toString();
      router.push(qs ? `/journal?${qs}` : "/journal");
    });
  }

  function applyFilter(next: TimelineFilter, nextMonth = month) {
    pushParams(next, nextMonth, query);
  }

  function applySearch() {
    pushParams(filter, month, query);
  }

  const months = groupByMonth(initialItems);

  return (
    <>
      <Workbench
        eyebrow="Journal · Timeline"
        title="记录"
        description="按时间合并日记与今日同步快照。"
        action={
          <Button href="/journal/new" className="hidden h-10 px-4 md:inline-flex">
            + 写一条
          </Button>
        }
        stats={[
          { label: "全部", value: stats.total },
          { label: "我的", value: stats.mine },
          { label: partnerNickname, value: stats.yours },
          { label: "本月", value: stats.month },
        ]}
        toolbar={
          <div>
            <JournalSectionTabs />
            <WorkbenchToolbar
              trailing={
                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value.slice(0, 80))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applySearch();
                    }}
                    placeholder="搜索标题/正文"
                    className="h-9 w-28 rounded-[10px] border border-line bg-white/45 px-3 text-[13px] text-ink outline-none placeholder:text-ink-tertiary md:w-40"
                  />
                  {filter === "month" ? (
                    <input
                      type="month"
                      value={month}
                      onChange={(e) => {
                        setMonth(e.target.value);
                        applyFilter("month", e.target.value);
                      }}
                      className="h-9 rounded-[10px] border border-line bg-white/45 px-3 text-[13px] text-ink outline-none"
                    />
                  ) : null}
                </div>
              }
            >
              {FILTERS.map((f) => (
                <WorkbenchTab
                  key={f.id}
                  active={filter === f.id}
                  disabled={pending}
                  onClick={() => applyFilter(f.id)}
                >
                  {f.id === "yours" ? partnerNickname : f.label}
                </WorkbenchTab>
              ))}
            </WorkbenchToolbar>
          </div>
        }
      >
        {initialItems.length === 0 ? (
          <div className="glass-panel flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
            <p className="font-display text-[22px] text-ink-secondary">
              还没有记录
            </p>
            <p className="mt-2 max-w-sm text-[13px] text-ink-tertiary">
              写一条日记，或同步今日后会出现在这里
            </p>
            <Button href="/journal/new" className="mt-6">
              写一条
            </Button>
          </div>
        ) : (
          <div className={cn("space-y-8", pending && "opacity-70")}>
            {months.map(([monthKey, items]) => (
              <section key={monthKey}>
                <h2 className="mb-3 font-display text-[20px] text-ink-secondary">
                  {formatMonthHeading(`${monthKey}-01`)}
                </h2>
                <ul className="divide-y divide-line border-y border-line">
                  {items.map((item) =>
                    item.kind === "entry" ? (
                      <li key={item.id}>
                        <Link
                          href={`/journal/${item.id}`}
                          className="block py-4 transition-colors hover:bg-white/25"
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="text-[13px] text-ink-secondary">
                              {formatDayShort(item.day)}
                            </span>
                            <span
                              className={cn(
                                "text-[12px] font-medium tracking-[0.04em]",
                                item.authorSide === "me"
                                  ? "text-me"
                                  : "text-you",
                              )}
                            >
                              {item.authorSide === "me"
                                ? "我"
                                : item.authorNickname}
                            </span>
                            {item.authorSide === "me" &&
                            item.visibility === "private" ? (
                              <span className="text-[11px] text-ink-tertiary">
                                仅自己
                              </span>
                            ) : null}
                            {item.authorSide === "me" && item.partnerReadAt ? (
                              <span className="text-[11px] text-ink-tertiary">
                                已读
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 text-[15px] font-medium text-ink">
                            {item.title || item.bodyPreview}
                          </p>
                          {item.title ? (
                            <p className="mt-1 text-[13px] text-ink-secondary line-clamp-2">
                              {item.bodyPreview}
                            </p>
                          ) : null}
                          {item.imageUrls.length > 0 ? (
                            <div className="mt-3 flex gap-1.5 overflow-x-auto">
                              {item.imageUrls.map((url) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={url}
                                  src={url}
                                  alt=""
                                  className="h-16 w-16 shrink-0 rounded-[var(--radius-md)] object-cover"
                                />
                              ))}
                            </div>
                          ) : null}
                        </Link>
                      </li>
                    ) : (
                      <li
                        key={item.id}
                        className="py-3 text-[13px] text-ink-secondary"
                      >
                        <span className="text-ink-tertiary">
                          {formatDayShort(item.day)} 同步
                        </span>
                        {" · "}
                        {item.mineLine ? (
                          <span>
                            我
                            {moodEmoji(item.mineMood)}：{item.mineLine}
                          </span>
                        ) : null}
                        {item.mineLine && item.yoursLine ? " / " : null}
                        {item.yoursLine ? (
                          <span>
                            {partnerNickname}
                            {moodEmoji(item.yoursMood)}：{item.yoursLine}
                          </span>
                        ) : null}
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Workbench>

      <Link
        href="/journal/new"
        className="fixed right-5 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+20px)] z-20 flex size-12 items-center justify-center rounded-[16px] bg-brand text-[#F5F6F4] shadow-[var(--shadow-sheet)] md:hidden"
        aria-label="写一条"
      >
        <Plus className="size-5" strokeWidth={2} />
      </Link>
    </>
  );
}

function groupByMonth(items: TimelineItem[]) {
  const map = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const key = item.day.slice(0, 7);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()];
}

function moodEmoji(mood: string | null) {
  if (!mood || !(mood in MOOD_BY_ID)) return "";
  return ` ${MOOD_BY_ID[mood as MoodId].emoji}`;
}
