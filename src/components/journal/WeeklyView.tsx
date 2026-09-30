"use client";

import { cn } from "@/lib/cn";
import { MOODS, type WeeklyMoodSide, type WeeklyMoodWeek } from "@/lib/checkin";
import { formatDayShort } from "@/lib/journal";

type WeeklyViewProps = {
  weeks: WeeklyMoodWeek[];
  togetherDaysThisWeek: number;
  togetherWeeksStreak: number;
  partnerNickname: string;
};

const MOOD_COLORS: Record<string, string> = {
  happy: "var(--brand)",
  ok: "var(--signal)",
  sad: "var(--danger)",
};

/** P1-2 心情周报轻量版：每周一行，双方心情堆叠条；不做分数/评级/断签 */
export function WeeklyView({
  weeks,
  togetherDaysThisWeek,
  togetherWeeksStreak,
  partnerNickname,
}: WeeklyViewProps) {
  const hasAnyData = weeks.some((w) => w.me.days > 0 || w.you.days > 0);

  if (!hasAnyData) {
    return (
      <div className="glass-panel flex min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center">
        <p className="font-display text-[20px] text-ink-secondary">
          最近 8 周还没有同步
        </p>
        <p className="mt-2 max-w-sm text-[13px] text-ink-tertiary">
          在今日页写下一句今天，周报就会开始生长
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel flex flex-wrap gap-x-8 gap-y-2 px-5 py-4 text-[13px]">
        <span className="text-ink-secondary">
          本周共同记录{" "}
          <strong className="font-display text-[16px] text-ink">
            {togetherDaysThisWeek}
          </strong>{" "}
          天
        </span>
        <span className="text-ink-secondary">
          连续共同记录{" "}
          <strong className="font-display text-[16px] text-ink">
            {togetherWeeksStreak}
          </strong>{" "}
          周
        </span>
      </div>

      <ul className="space-y-2.5">
        {weeks.map((w) => (
          <li key={w.start} className="glass-panel px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-[12px] text-ink-tertiary">
                {formatDayShort(w.start)}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <MoodBar side={w.me} label="我" />
                <MoodBar side={w.you} label={partnerNickname} tone="you" />
              </div>
              <span className="w-16 shrink-0 text-right text-[11px] text-ink-tertiary">
                {w.me.days + w.you.days > 0 ? `${w.me.days + w.you.days} 条` : "—"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] text-ink-tertiary">
        <span>图例：</span>
        {MOODS.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: MOOD_COLORS[m.id] }}
            />
            {m.label}
          </span>
        ))}
        <span>深 = 我 · 浅 = {partnerNickname}</span>
      </div>
    </div>
  );
}

function MoodBar({
  side,
  label,
  tone = "me",
}: {
  side: WeeklyMoodSide;
  label: string;
  tone?: "me" | "you";
}) {
  const total = side.happy + side.ok + side.sad;
  const barBase = tone === "me" ? "" : "opacity-55";

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "w-6 shrink-0 text-[10px]",
          tone === "me" ? "text-me" : "text-you",
        )}
      >
        {label}
      </span>
      <div className="flex h-2 min-w-0 flex-1 gap-px overflow-hidden rounded-full bg-white/40">
        {total === 0 ? null : (
          <>
            {(["happy", "ok", "sad"] as const).map((mood) => {
              const n = side[mood];
              if (n === 0) return null;
              return (
                <span
                  key={mood}
                  className={cn("h-full", barBase)}
                  style={{
                    width: `${(n / total) * 100}%`,
                    background: MOOD_COLORS[mood],
                  }}
                />
              );
            })}
          </>
        )}
      </div>
      <span className="w-8 shrink-0 text-right text-[10px] text-ink-tertiary">
        {side.days > 0 ? `${side.days}日` : ""}
      </span>
    </div>
  );
}
