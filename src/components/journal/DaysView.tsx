"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { DayMarkSheet } from "@/components/journal/DayMarkSheet";
import { JournalSectionTabs } from "@/components/journal/JournalSectionTabs";
import {
  Workbench,
  WorkbenchToolbar,
} from "@/components/shell/Workbench";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  buildMonthGrid,
  formatMonthTitle,
  shiftMonth,
  type DayMarkDTO,
} from "@/lib/daymark";
import { formatDayShort } from "@/lib/journal";

type DaysViewProps = {
  month: string;
  selectedDay: string;
  today: string;
  markedDays: string[];
  dayMarks: DayMarkDTO[];
  upcoming: DayMarkDTO[];
  past: DayMarkDTO[];
};

export function DaysView({
  month: initialMonth,
  selectedDay: initialSelected,
  today,
  markedDays,
  dayMarks,
  upcoming,
  past,
}: DaysViewProps) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState(initialSelected);
  const [pastOpen, setPastOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<DayMarkDTO | null>(null);
  const [pending, startTransition] = useTransition();

  const marked = new Set(markedDays);
  const grid = buildMonthGrid(month);

  function navigate(nextMonth: string, nextDay: string) {
    setMonth(nextMonth);
    setSelectedDay(nextDay);
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("month", nextMonth);
      params.set("day", nextDay);
      router.push(`/journal/days?${params.toString()}`);
    });
  }

  function selectDay(day: string) {
    navigate(day.slice(0, 7), day);
  }

  function changeMonth(delta: number) {
    const next = shiftMonth(month, delta);
    const day =
      today.startsWith(next) ? today : `${next}-01`;
    navigate(next, day);
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <>
      <Workbench
        eyebrow="Journal · Days"
        title="日子"
        description="把约定、纪念日和普通标日记在同一本月历上。"
        action={
          <Button
            className="hidden h-10 px-4 md:inline-flex"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            + 标记一天
          </Button>
        }
        stats={[
          { label: "即将到来", value: upcoming.length },
          { label: "已过", value: past.length },
          { label: "当日", value: dayMarks.length },
        ]}
        toolbar={
          <div>
            <JournalSectionTabs />
            <WorkbenchToolbar
              trailing={
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-[10px] text-ink-secondary hover:bg-white/45"
                    aria-label="上一月"
                    onClick={() => changeMonth(-1)}
                    disabled={pending}
                  >
                    <ChevronLeft className="size-4" strokeWidth={1.75} />
                  </button>
                  <span className="min-w-[6.5rem] text-center text-[13px] font-medium text-ink">
                    {formatMonthTitle(month)}
                  </span>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-[10px] text-ink-secondary hover:bg-white/45"
                    aria-label="下一月"
                    onClick={() => changeMonth(1)}
                    disabled={pending}
                  >
                    <ChevronRight className="size-4" strokeWidth={1.75} />
                  </button>
                </div>
              }
            >
              <span className="px-2 text-[12px] text-ink-tertiary">月历</span>
            </WorkbenchToolbar>
          </div>
        }
      >
        <div className={cn("space-y-8", pending && "opacity-70")}>
          <div className="glass-panel p-3 md:p-4">
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] tracking-[0.04em] text-ink-tertiary">
              {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.cells.map((cell, i) => {
                if (!cell) {
                  return <div key={`empty-${i}`} className="aspect-square" />;
                }
                const isSelected = cell.day === selectedDay;
                const isToday = cell.day === today;
                const hasMark = marked.has(cell.day);
                return (
                  <button
                    key={cell.day}
                    type="button"
                    onClick={() => selectDay(cell.day)}
                    className={cn(
                      "relative flex aspect-square flex-col items-center justify-center rounded-[12px] text-[14px] transition-colors",
                      isSelected
                        ? "bg-brand text-[#F5F6F4]"
                        : isToday
                          ? "bg-brand-soft text-brand"
                          : "text-ink hover:bg-white/50",
                    )}
                  >
                    {Number(cell.day.slice(8))}
                    {hasMark ? (
                      <span
                        className={cn(
                          "absolute bottom-1.5 size-1 rounded-full",
                          isSelected ? "bg-white/90" : "bg-brand",
                        )}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[20px] text-ink-secondary">
                {formatDayShort(selectedDay)}
              </h2>
              <button
                type="button"
                className="text-[13px] font-medium text-brand"
                onClick={() => {
                  setEditing(null);
                  setSheetOpen(true);
                }}
              >
                + 标记
              </button>
            </div>
            {dayMarks.length === 0 ? (
              <p className="text-[13px] text-ink-tertiary">这一天还没有标记</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {dayMarks.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start py-3.5 text-left hover:bg-white/25"
                      onClick={() => {
                        setEditing(m);
                        setSheetOpen(true);
                      }}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-[15px] font-medium text-ink">
                          {m.title}
                        </span>
                        {m.yearly ? (
                          <span className="text-[11px] tracking-[0.04em] text-ink-tertiary">
                            周年
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "text-[12px]",
                            m.authorSide === "me" ? "text-me" : "text-you",
                          )}
                        >
                          {m.authorSide === "me" ? "我" : m.authorNickname}
                        </span>
                      </div>
                      {m.note ? (
                        <p className="mt-1 text-[13px] text-ink-secondary">
                          {m.note}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-display text-[20px] text-ink-secondary">
              即将到来
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-[13px] text-ink-tertiary">暂无临近标记</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.slice(0, 12).map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full items-baseline gap-3 rounded-[12px] px-2 py-2 text-left hover:bg-white/30"
                      onClick={() => {
                        setEditing(m);
                        setSheetOpen(true);
                      }}
                    >
                      <span className="w-12 shrink-0 text-[13px] text-ink-secondary">
                        {formatDayShort(m.nextDay)}
                      </span>
                      <span className="text-[14px] font-medium text-ink">
                        {m.title}
                      </span>
                      {m.yearly ? (
                        <span className="text-[11px] text-ink-tertiary">周年</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <button
              type="button"
              className="mb-3 flex items-center gap-2 font-display text-[20px] text-ink-secondary"
              onClick={() => setPastOpen((o) => !o)}
            >
              已过
              <span className="text-[12px] font-sans text-ink-tertiary">
                {pastOpen ? "收起" : `展开 ${past.length}`}
              </span>
            </button>
            {pastOpen ? (
              past.length === 0 ? (
                <p className="text-[13px] text-ink-tertiary">暂无已过标记</p>
              ) : (
                <ul className="space-y-2">
                  {past.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="flex w-full items-baseline gap-3 rounded-[12px] px-2 py-2 text-left opacity-75 hover:bg-white/30"
                        onClick={() => {
                          setEditing(m);
                          setSheetOpen(true);
                        }}
                      >
                        <span className="w-12 shrink-0 text-[13px] text-ink-secondary">
                          {formatDayShort(m.nextDay)}
                        </span>
                        <span className="text-[14px] text-ink">{m.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </section>
        </div>
      </Workbench>

      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
        className="fixed right-5 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+20px)] z-20 flex size-12 items-center justify-center rounded-[16px] bg-brand text-[#F5F6F4] shadow-[var(--shadow-sheet)] md:hidden"
        aria-label="标记一天"
      >
        <Plus className="size-5" strokeWidth={2} />
      </button>

      <DayMarkSheet
        open={sheetOpen}
        mode={editing ? "edit" : "create"}
        initialDay={selectedDay}
        initial={editing}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onSaved={refresh}
      />
    </>
  );
}
