"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { RefreshCw, Timer, TimerOff } from "lucide-react";
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
import {
  formatTodayLabel,
  longDistanceLine,
  type CheckIn,
  type StreakBadge,
} from "@/lib/checkin";
import {
  HEARTBEAT_IDLE_MS,
  HEARTBEAT_MS,
  setHeartbeatRate,
  useHeartbeat,
} from "@/lib/heartbeat";
import { dayLeftLine } from "@/lib/goal";
import type { DayMarkHint } from "@/lib/daymark";
import type { OnThisDayItem } from "@/lib/journal";
import { daysSinceAnniversary } from "@/lib/space";
import {
  hugTodayAction,
  saveTodayCheckInAction,
} from "@/server/checkin-actions";

const POLL_KEY = "duet.today.poll";

/** P5-O2：弹层保存后的满速短窗口 */
const STABLE_BOOST_MS = 90_000;

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
  /** P3-T11：最新一个进行中目标（只一条） */
  goalHint?: {
    id: string;
    title: string;
    doneCount: number;
    totalCount: number;
    targetDay?: string | null;
    /** P4-W6：距目标日天数（null = 未设；0 = 就是今天；负 = 已过期未完成） */
    daysLeft?: number | null;
  } | null;
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
  goalHint = null,
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
  /** P5-O2：刚保存过（满速保底窗口，到点自动过期） */
  const [savedRecently, setSavedRecently] = useState(false);

  const syncedCount = Number(Boolean(mine)) + Number(Boolean(yours));
  // P5-O2：双方都已同步、对方已读且不在刚保存的满速窗口内 → 心跳降为 3 分钟
  const dataStable = syncedCount === 2 && !partnerWasUnread && !savedRecently;

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

  // P5-O2：满速窗口到点自动过期（回到静止退坡判断）
  useEffect(() => {
    if (!savedRecently) return;
    const t = window.setTimeout(() => setSavedRecently(false), STABLE_BOOST_MS);
    return () => window.clearTimeout(t);
  }, [savedRecently]);

  // P5-O2：统一心跳（与悄悄话未读检查共用一条定时器；自动刷新已关时只静默不再刷新）
  useHeartbeat(() => {
    if (!pollEnabled) return;
    router.refresh();
  });

  useEffect(() => {
    setHeartbeatRate(dataStable ? HEARTBEAT_IDLE_MS : HEARTBEAT_MS);
    return () => setHeartbeatRate(HEARTBEAT_MS);
  }, [dataStable]);

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

  // P5-O1：状态角标一行（记录徽章 + 异地徽标合并；都无则整行消失）；异地只算一次
  const distanceLine = longDistanceLine(
    mine?.city ?? null,
    yours?.city ?? null,
    partnerNickname,
  );
  const statusLine =
    [streakBadge?.line, distanceLine].filter(Boolean).join(" · ") || null;

  // P5-O1：提示灯——最多 3 行，优先级 日子临近 > 时光信 > 目标 > 那年今日
  const hintNodes: { rank: number; node: ReactNode }[] = [];
  if (dayHint) {
    hintNodes.push({
      rank: 1,
      node: (
        <Link
          href="/journal/days"
          className="block text-[13px] text-ink-secondary hover:text-brand"
        >
          {dayHint.label}
        </Link>
      ),
    });
  }
  if (letterHint) {
    hintNodes.push({
      rank: 2,
      node: (
        <Link
          href="/us/letters"
          className="block text-[13px] text-ink-secondary hover:text-brand"
        >
          ✉ {letterHint.title ? `《${letterHint.title}》` : "有一封信"}
          将于 {letterHint.unlockDay} 开启
          {letterHint.daysLeft > 0
            ? ` · 还有 ${letterHint.daysLeft} 天`
            : " · 今天开启 ✨"}
        </Link>
      ),
    });
  }
  if (goalHint) {
    hintNodes.push({
      rank: 3,
      node: (
        <Link
          href="/us/goals"
          className="block text-[13px] text-ink-secondary hover:text-brand"
        >
          🎯 {goalHint.title}
          {goalHint.totalCount > 0
            ? ` · ${goalHint.doneCount}/${goalHint.totalCount}`
            : ""}
          {goalHint.targetDay && goalHint.daysLeft != null
            ? ` · 目标日 ${goalHint.targetDay.slice(5)}${dayLeftLine(goalHint.daysLeft, " · ")}`
            : ""}
        </Link>
      ),
    });
  }
  if (onThisDay) {
    hintNodes.push({
      rank: 4,
      node: (
        <Link
          href={`/journal/${onThisDay.id}`}
          className="block text-[13px] text-ink-secondary hover:text-brand"
        >
          🗓 {onThisDay.yearsAgo} 年前的今天写过：《
          {onThisDay.title || onThisDay.bodyPreview}》
        </Link>
      ),
    });
  }
  hintNodes.sort((a, b) => a.rank - b.rank);
  const visibleHints = hintNodes.slice(0, 3);

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
        city: next.city,
        company: next.company,
      });
      if (!res.ok || !res.checkIn) {
        setError(res.error || "同步失败");
        return;
      }
      setMine(res.checkIn);
      setMineKey((k) => k + 1);
      setSavedRecently(true);
      setSheetOpen(false);
    });
  }

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
            >
              <RefreshCw
                className={`size-3.5 ${pending ? "animate-spin" : ""}`}
                strokeWidth={1.75}
              />
              刷新
            </button>
            <button
              type="button"
              onClick={togglePoll}
              title={
                pollEnabled
                  ? "自动刷新：开（45s，页面静止时退为 3 分钟）· 点击关闭"
                  : "自动刷新：已关 · 点击开启"
              }
              aria-label={pollEnabled ? "关闭自动刷新" : "开启自动刷新"}
              className="flex size-10 items-center justify-center rounded-[12px] bg-white/45 text-ink-tertiary hover:bg-white/60"
            >
              {pollEnabled ? (
                <Timer className="size-4" strokeWidth={1.75} />
              ) : (
                <TimerOff className="size-4" strokeWidth={1.75} />
              )}
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

        {visibleHints.length > 0 ? (
          <div className="mb-4 space-y-2">
            {visibleHints.map((h) => (
              <div key={h.rank}>{h.node}</div>
            ))}
          </div>
        ) : null}

        {statusLine ? (
          <p className="mb-4 text-[12px] tracking-[0.02em] text-ink-tertiary">
            {statusLine}
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
          {onThisDayList ? (
            <p className="mt-2 text-[13px] text-ink-secondary">
              ☑ {onThisDayList.yearsAgo} 年前今天完成了「{onThisDayList.title}」
            </p>
          ) : null}
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
