"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { PersonColumn } from "@/components/today/PersonColumn";
import { UpdateTodaySheet } from "@/components/today/UpdateTodaySheet";
import {
  Workbench,
  WorkbenchTab,
  WorkbenchToolbar,
} from "@/components/shell/Workbench";
import { Button } from "@/components/ui/Button";
import { formatTodayLabel, type CheckIn } from "@/lib/checkin";
import { saveTodayCheckInAction } from "@/server/checkin-actions";

type TodayViewProps = {
  initialMine: CheckIn | null;
  initialYours: CheckIn | null;
  partnerWasUnread?: boolean;
  partnerNickname?: string;
  todayEntryCount?: number;
};

export function TodayView({
  initialMine,
  initialYours,
  partnerWasUnread = false,
  partnerNickname = "你",
  todayEntryCount = 0,
}: TodayViewProps) {
  const dateLabel = formatTodayLabel();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focus, setFocus] = useState<"both" | "you" | "me">("both");
  const [mine, setMine] = useState<CheckIn | null>(initialMine);
  const [yours] = useState<CheckIn | null>(initialYours);
  const [partnerUnread, setPartnerUnread] = useState(partnerWasUnread);
  const [mineKey, setMineKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!partnerWasUnread) return;
    const t = window.setTimeout(() => setPartnerUnread(false), 800);
    return () => window.clearTimeout(t);
  }, [partnerWasUnread]);

  function handleSave(
    next: Omit<CheckIn, "partnerReadAt"> & { partnerReadAt: null },
  ) {
    setError(null);
    startTransition(async () => {
      const res = await saveTodayCheckInAction({
        mood: next.mood,
        line: next.line,
        note: next.note,
        imageUrl: next.imageUrl,
      });
      if (!res.ok || !res.checkIn) {
        setError(res.error || "同步失败");
        return;
      }
      setMine(res.checkIn);
      setMineKey((k) => k + 1);
      setSheetOpen(false);
    });
  }

  const syncedCount = Number(Boolean(mine)) + Number(Boolean(yours));

  return (
    <>
      <Workbench
        eyebrow="Today · Sync Desk"
        title="今日展台"
        description={`${dateLabel} · 先看对方，再写下自己的今天`}
        action={
          <Button
            className="h-10 px-4"
            onClick={() => setSheetOpen(true)}
            disabled={pending}
          >
            更新今日
          </Button>
        }
        stats={[
          { label: "已同步", value: `${syncedCount}/2` },
          {
            label: "对方状态",
            value: yours ? (partnerUnread ? "未读" : "已读") : "等待",
          },
          { label: "我的状态", value: mine ? "已写" : "未写" },
          { label: "关联日记", value: todayEntryCount },
        ]}
        toolbar={
          <WorkbenchToolbar
            trailing={
              <label className="flex h-9 items-center gap-2 rounded-[10px] bg-white/45 px-3 text-[13px] text-ink-tertiary">
                <Search className="size-3.5" strokeWidth={1.75} />
                <input
                  className="w-28 bg-transparent text-ink outline-none placeholder:text-ink-tertiary md:w-40"
                  placeholder="搜索今日…"
                  disabled
                />
              </label>
            }
          >
            <WorkbenchTab
              active={focus === "both"}
              onClick={() => setFocus("both")}
            >
              全部
            </WorkbenchTab>
            <WorkbenchTab
              active={focus === "you"}
              onClick={() => setFocus("you")}
            >
              只看{partnerNickname}
            </WorkbenchTab>
            <WorkbenchTab active={focus === "me"} onClick={() => setFocus("me")}>
              只看我
            </WorkbenchTab>
          </WorkbenchToolbar>
        }
      >
        {error ? (
          <p className="mb-4 text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div
          className={
            focus === "both"
              ? "grid gap-4 md:grid-cols-2 md:gap-5"
              : "grid gap-4"
          }
        >
          {(focus === "both" || focus === "you") && (
            <div
              key={`you-${yours?.updatedAt ?? "empty"}`}
              className={yours ? "animate-checkin" : undefined}
            >
              <PersonColumn
                who="you"
                label={partnerNickname}
                emptyHint="TA 今天还没同步"
                checkIn={yours}
                unread={partnerUnread}
              />
            </div>
          )}
          {(focus === "both" || focus === "me") && (
            <div
              key={`me-${mineKey}`}
              className={mine ? "animate-checkin" : undefined}
            >
              <PersonColumn
                who="me"
                label="我"
                emptyHint="写一句今天"
                checkIn={mine}
                onEmptyClick={() => setSheetOpen(true)}
              />
            </div>
          )}
        </div>

        {(mine?.note || yours?.note) && (
          <section className="mt-6">
            <p className="mb-3 text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
              今日想说的话
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {yours?.note ? (
                <div className="glass-panel p-4 shadow-[inset_3px_0_0_var(--you)]">
                  <p className="text-[12px] font-medium tracking-[0.04em] text-you">
                    {partnerNickname}
                  </p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
                    {yours.note}
                  </p>
                </div>
              ) : null}
              {mine?.note ? (
                <div className="glass-panel p-4 shadow-[inset_3px_0_0_var(--me)]">
                  <p className="text-[12px] font-medium tracking-[0.04em] text-me">
                    我
                  </p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
                    {mine.note}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        )}

        <section className="mt-6 glass-panel p-4">
          <p className="text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
            今日相关
          </p>
          {todayEntryCount > 0 ? (
            <Link
              href="/journal"
              className="mt-2 block text-[14px] text-brand hover:underline"
            >
              今日已写 {todayEntryCount} 条日记 → 查看记录
            </Link>
          ) : (
            <p className="mt-2 text-[14px] text-ink-secondary">暂无关联日记</p>
          )}
        </section>
      </Workbench>

      <UpdateTodaySheet
        open={sheetOpen}
        initial={mine}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
        saving={pending}
      />
    </>
  );
}
