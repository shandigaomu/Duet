"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { CollabInviteCard } from "@/components/today/CollabInviteCard";
import { PartnerClock } from "@/components/today/PartnerClock";
import { PersonColumn } from "@/components/today/PersonColumn";
import { UpdateTodaySheet } from "@/components/today/UpdateTodaySheet";
import {
  Workbench,
  WorkbenchTab,
  WorkbenchToolbar,
} from "@/components/shell/Workbench";
import { Button } from "@/components/ui/Button";
import { formatTodayLabel, type CheckIn, type StreakBadge } from "@/lib/checkin";
import type { DayMarkHint } from "@/lib/daymark";
import type { OnThisDayItem } from "@/lib/journal";
import { daysSinceAnniversary } from "@/lib/space";
import {
  hugTodayAction,
  saveTodayCheckInAction,
} from "@/server/checkin-actions";

const POLL_KEY = "duet.today.poll";
const POLL_MS = 45_000;

type TodayViewProps = {
  initialMine: CheckIn | null;
  initialYours: CheckIn | null;
  partnerWasUnread?: boolean;
  partnerNickname?: string;
  todayEntryCount?: number;
  dayHint?: DayMarkHint | null;
  anniversaryDay?: string | null;
  onThisDay?: OnThisDayItem | null;
  /** P2-N2：对方今天抱过我 */
  hugFromPartner?: { at: string } | null;
  /** P2-N2：我今天是否已抱过对方 */
  hugGivenByMe?: boolean;
  /** P2-N4：对方时区（null = 上海） */
  partnerTimeZone?: string | null;
  /** P2-N8：合写邀请卡 */
  collabInvite?: {
    entryId: string;
    day: string;
    title: string | null;
    authorNickname: string;
    mySectionSubmitted: boolean;
    iConfirmed: boolean;
    partnerConfirmed: boolean;
  } | null;
  /** P2-N8：我发起的合写（等待对方） */
  myPendingInvite?: { entryId: string; day: string; title: string | null } | null;
  /** P3-T10：记录徽章（null = 达不成，安静消失） */
  streakBadge?: StreakBadge;
  /** P3-T3：那年今天完成的清单项 */
  onThisDayList?: { id: string; yearsAgo: number; title: string; categoryLabel: string } | null;
  /** P3-T4：最近一封待解锁信（收信方 title 置 null） */
  letterHint?: { unlockDay: string; title: string | null; daysLeft: number } | null;
};

export function TodayView({
  initialMine,
  initialYours,
  partnerWasUnread = false,
  partnerNickname = "你",
  todayEntryCount = 0,
  dayHint = null,
  anniversaryDay = null,
  onThisDay = null,
  hugFromPartner = null,
  hugGivenByMe = false,
  partnerTimeZone = null,
  collabInvite = null,
  myPendingInvite = null,
  streakBadge = null,
  onThisDayList = null,
  letterHint = null,
}: TodayViewProps) {
  const router = useRouter();
  const dateLabel = formatTodayLabel();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focus, setFocus] = useState<"both" | "you" | "me">("both");
  const [mine, setMine] = useState<CheckIn | null>(initialMine);
  const [yours] = useState<CheckIn | null>(initialYours);
  const [partnerUnread, setPartnerUnread] = useState(partnerWasUnread);
  const [mineKey, setMineKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pollEnabled, setPollEnabled] = useState(true);
  const [hugGiven, setHugGiven] = useState(hugGivenByMe);
  const [hugging, setHugging] = useState(false);
  const [hugPulse, setHugPulse] = useState(false);

  useEffect(() => {
    // 延迟到渲染后读取，避免同步 setState 触发级联渲染（react-hooks/set-state-in-effect）
    const t = window.setTimeout(() => {
      try {
        if (localStorage.getItem(POLL_KEY) === "0") setPollEnabled(false);
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!partnerWasUnread) return;
    const t = window.setTimeout(() => setPartnerUnread(false), 800);
    return () => window.clearTimeout(t);
  }, [partnerWasUnread]);

  useEffect(() => {
    if (!pollEnabled) return;
    function tick() {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    }
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [pollEnabled, router]);

  function togglePoll() {
    setPollEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(POLL_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  // P2-N2：抱抱（乐观置灰 + 微动画；失败回滚）
  function giveHug() {
    if (hugGiven || hugging) return;
    setHugging(true);
    setHugGiven(true);
    setHugPulse(true);
    window.setTimeout(() => setHugPulse(false), 900);
    void hugTodayAction()
      .then((res) => {
        if (!res.ok) {
          setHugGiven(false);
          setError(res.error || "抱抱失败");
        }
      })
      .catch(() => {
        setHugGiven(false);
        setError("网络异常，抱抱没送到");
      })
      .finally(() => setHugging(false));
  }

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
  const anniversaryDays =
    anniversaryDay && !anniversaryDay.startsWith("0000")
      ? daysSinceAnniversary(anniversaryDay)
      : null;

  return (
    <>
      <Workbench
        eyebrow="Today · Sync Desk"
        title="今日展台"
        description={
          anniversaryDays != null && anniversaryDays > 0
            ? `${dateLabel} · 在一起第 ${anniversaryDays} 天`
            : dateLabel
        }
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={pending}
              className="flex h-10 items-center gap-1.5 rounded-[12px] bg-white/45 px-3 text-[13px] text-ink-secondary hover:bg-white/60"
              aria-label="刷新"
              title={pollEnabled ? "自动刷新已开" : "自动刷新已关"}
            >
              <RefreshCw
                className={`size-3.5 ${pending ? "animate-spin" : ""}`}
                strokeWidth={1.75}
              />
              刷新
            </button>
            <Button
              className="h-10 px-4"
              onClick={() => setSheetOpen(true)}
              disabled={pending}
            >
              更新今日
            </Button>
          </div>
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
          <WorkbenchToolbar>
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

        <CollabInviteCard invite={collabInvite} myPendingInvite={myPendingInvite} />

        {dayHint ? (
          <Link
            href="/journal/days"
            className="mb-4 block text-[13px] text-ink-secondary hover:text-brand"
          >
            {dayHint.label}
          </Link>
        ) : null}

        {streakBadge ? (
          <p className="mb-4 text-[12px] tracking-[0.02em] text-ink-tertiary">
            {streakBadge.line}
          </p>
        ) : null}

        {letterHint ? (
          <Link
            href="/us/letters"
            className="mb-4 block text-[13px] text-ink-secondary hover:text-brand"
          >
            ✉ {letterHint.title ? `《${letterHint.title}》` : "有一封信"}
            将于 {letterHint.unlockDay} 开启
            {letterHint.daysLeft > 0 ? ` · 还有 ${letterHint.daysLeft} 天` : " · 今天开启 ✨"}
          </Link>
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
              <div className={hugPulse ? "animate-[pulse_0.45s_ease-in-out_2]" : undefined}>
                <PersonColumn
                  who="you"
                  label={partnerNickname}
                  headerLabel={
                    <PartnerClock
                      timeZone={partnerTimeZone}
                      partnerNickname={partnerNickname}
                    />
                  }
                  emptyHint="TA 今天还没同步"
                  checkIn={yours}
                  unread={partnerUnread}
                  onHug={yours ? giveHug : undefined}
                  hugGiven={hugGiven}
                  hugPending={hugging}
                />
              </div>
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
                hugFromPartner={hugFromPartner}
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
          {onThisDay ? (
            <Link
              href={`/journal/${onThisDay.id}`}
              className="mt-2 block text-[14px] text-brand hover:underline"
            >
              {onThisDay.yearsAgo} 年前的今天写过：《{onThisDay.title || onThisDay.bodyPreview}》
            </Link>
          ) : null}
          {onThisDayList ? (
            <p className="mt-2 text-[13px] text-ink-secondary">
              ☑ {onThisDayList.yearsAgo} 年前今天完成了「{onThisDayList.title}」
            </p>
          ) : null}
          <button
            type="button"
            onClick={togglePoll}
            className="mt-3 text-[12px] text-ink-tertiary hover:text-ink-secondary"
          >
            自动刷新：{pollEnabled ? "开（45s）" : "关"}
          </button>
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
