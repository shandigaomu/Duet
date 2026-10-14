import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
import { Workbench } from "@/components/shell/Workbench";
import { cn } from "@/lib/cn";
import { formatDayShort } from "@/lib/journal";
import type { YearInReview } from "@/server/year-actions";

const MOOD_COLORS: Record<"happy" | "ok" | "sad", string> = {
  happy: "var(--brand)",
  ok: "var(--signal)",
  sad: "var(--danger)",
};

type YearViewProps = {
  data: YearInReview;
  partnerNickname: string;
};

/** P3-T9 年度关键词卡：一屏回忆密度，不做成报告 */
export function YearView({ data, partnerNickname }: YearViewProps) {
  const moodTotal = {
    me: data.mood.me.happy + data.mood.me.ok + data.mood.me.sad,
    you: data.mood.you.happy + data.mood.you.ok + data.mood.you.sad,
  };
  const hasAnyData =
    data.recordDays + data.entryCount + data.doneListCount + data.hugCount > 0;
  const keywordSpace = data.keywords.length >= 3;

  return (
    <Workbench
      eyebrow="Us · Year"
      title={`${data.year} 年度的我们`}
      description="一张卡的轻量年度回顾——不必是报告，是回忆。"
      action={
        <div className="flex items-center gap-1.5">
          {data.years.map((y) => (
            <Link
              key={y}
              href={`/us/year?year=${y}`}
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px]",
                y === data.year
                  ? "bg-brand text-white"
                  : "text-ink-secondary hover:bg-white/45",
              )}
            >
              {y}
            </Link>
          ))}
        </div>
      }
    >
      {keywordSpace ? (
        <div className="glass-panel mb-6 p-6">
          <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
            <Sparkles className="size-3.5" strokeWidth={1.75} />
            年度关键词
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.keywords.map((k, i) => (
              <span
                key={k}
                className={cn(
                  "rounded-full border border-brand/25 bg-brand-soft/50 px-3.5 py-1.5 font-display",
                  // 首词稍大，制造视觉层级
                  i === 0 ? "text-[19px] text-ink" : "text-[15px] text-ink-secondary",
                )}
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="glass-panel p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="共同记录" value={hasAnyData ? `${data.recordDays} 天` : "—"} />
          <Stat label="日记" value={data.entryCount > 0 ? `${data.entryCount} 篇` : "—"} />
          <Stat label="完成清单" value={data.doneListCount > 0 ? `${data.doneListCount} 项` : "—"} />
          <Stat label="互给抱抱" value={data.hugCount > 0 ? `${data.hugCount} 个` : "—"} />
        </div>
        <p className="mt-3 text-[12px] text-ink-tertiary">
          {data.topMonth
            ? `最常写日记的月份：${data.topMonth.replace("-", " 年 ").replace(/^/, "")} 月`
            : "这一年还没有写下日记"}
        </p>
      </div>

      <div className="glass-panel mt-4 p-5">
        <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
          心情分布
        </p>
        <div className="mt-3 space-y-2.5">
          <MoodBar
            side={data.mood.me}
            total={moodTotal.me}
            label="我"
            tone="me"
          />
          <MoodBar
            side={data.mood.you}
            total={moodTotal.you}
            label={partnerNickname}
            tone="you"
          />
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-ink-tertiary">
          <span>开心</span>
          <span className="inline-block size-2 rounded-full" style={{ background: MOOD_COLORS.happy }} />
          <span>还行</span>
          <span className="inline-block size-2 rounded-full" style={{ background: MOOD_COLORS.ok }} />
          <span>沮丧</span>
          <span className="inline-block size-2 rounded-full" style={{ background: MOOD_COLORS.sad }} />
          <span>深 = 我 · 浅 = {partnerNickname}</span>
        </div>
      </div>

      {data.earliest ? (
        <Link
          href={`/journal/${data.earliest.id}`}
          className="mt-4 flex items-center justify-between glass-panel p-5 transition-colors hover:bg-white/40"
        >
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
              最早的一篇
            </p>
            <p className="mt-1 text-[15px] text-ink">
              {data.earliest.title || "一篇没有标题的日记"}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-tertiary">
              {formatDayShort(data.earliest.day)}
            </p>
          </div>
          <span className="text-[13px] text-brand">去重读 →</span>
        </Link>
      ) : null}

      {hasAnyData ? (
        <p className="mt-8 flex items-center gap-1.5 text-[12px] text-ink-tertiary">
          <Heart className="size-3.5" strokeWidth={1.75} />
          {data.year} · 两个人一起记下的
        </p>
      ) : (
        <p className="mt-8 text-center text-[14px] text-ink-tertiary">
          {data.year} 年的回忆还是空白——从写下一篇开始。
        </p>
      )}
    </Workbench>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-tertiary">{label}</p>
      <p className="mt-1 font-display text-[22px] text-ink">{value}</p>
    </div>
  );
}

function MoodBar({
  side,
  total,
  label,
  tone,
}: {
  side: { happy: number; ok: number; sad: number };
  total: number;
  label: string;
  tone: "me" | "you";
}) {
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
      <div className="flex h-2.5 min-w-0 flex-1 gap-px overflow-hidden rounded-full bg-white/40">
        {total === 0 ? null : (
          <>
            {(["happy", "ok", "sad"] as const).map((mood) => {
              const n = side[mood];
              if (n === 0) return null;
              return (
                <span
                  key={mood}
                  className={cn("h-full", tone === "you" && "opacity-55")}
                  style={{
                    background: MOOD_COLORS[mood],
                    width: `${(n / total) * 100}%`,
                  }}
                />
              );
            })}
          </>
        )}
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] text-ink-tertiary">
        {total > 0 ? `${total} 天` : "—"}
      </span>
    </div>
  );
}
