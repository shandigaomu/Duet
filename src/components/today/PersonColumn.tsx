"use client";

import { cn } from "@/lib/cn";
import { formatSyncTime, type CheckIn } from "@/lib/checkin";
import { MoodPicker } from "@/components/today/MoodPicker";

type PersonColumnProps = {
  who: "me" | "you";
  label: string;
  emptyHint: string;
  checkIn: CheckIn | null;
  unread?: boolean;
  onEmptyClick?: () => void;
  className?: string;
  /** P2-N2：抱抱 */
  onHug?: () => void;
  hugGiven?: boolean;
  hugPending?: boolean;
  /** 对方今天抱过我（仅 me 卡显示） */
  hugFromPartner?: { at: string } | null;
  /** P2-N4：替换列头 label 的对方时钟 */
  headerLabel?: React.ReactNode;
};

export function PersonColumn({
  who,
  label,
  emptyHint,
  checkIn,
  unread = false,
  onEmptyClick,
  className,
  onHug,
  hugGiven = false,
  hugPending = false,
  hugFromPartner = null,
  headerLabel,
}: PersonColumnProps) {
  const isMe = who === "me";

  return (
    <section className={cn("flex min-h-[200px] flex-col", className)}>
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        {headerLabel ?? (
          <p
            className={cn(
              "text-[12px] font-medium tracking-[0.06em]",
              isMe ? "text-me" : "text-you",
            )}
          >
            {label}
          </p>
        )}
        {!isMe && checkIn && onHug ? (
          <button
            type="button"
            onClick={onHug}
            disabled={hugGiven || hugPending}
            title={hugGiven ? "今天已经抱过啦" : "给 TA 一个抱抱"}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] transition active:scale-95",
              hugGiven
                ? "bg-brand-soft text-brand"
                : checkIn.mood === "sad"
                  ? "bg-you-soft font-medium text-you hover:brightness-95"
                  : "border border-line text-ink-tertiary opacity-75 hover:border-brand hover:text-brand",
            )}
          >
            <span aria-hidden>🫂</span>
            {hugGiven ? "已抱抱" : "抱抱"}
          </button>
        ) : null}
        {!isMe && checkIn && unread ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-signal">
            <span className="signal-dot size-1.5 rounded-full bg-signal" aria-hidden />
            未读
          </span>
        ) : null}
        {!isMe && checkIn && !unread && !onHug ? (
          <span className="text-[12px] text-ink-tertiary">已读</span>
        ) : null}
      </div>

      {!checkIn ? (
        <button
          type="button"
          onClick={onEmptyClick}
          disabled={!onEmptyClick}
          className={cn(
            "glass-panel flex flex-1 items-center justify-center border-dashed px-4 py-10 text-left",
            isMe ? "shadow-[inset_3px_0_0_var(--me)]" : "shadow-[inset_3px_0_0_var(--you)]",
            onEmptyClick && "pressable cursor-pointer",
            !onEmptyClick && "cursor-default",
          )}
        >
          <p className="font-display text-center text-[18px] leading-snug text-ink-secondary">
            {emptyHint}
          </p>
        </button>
      ) : (
        <div
          className={cn(
            "glass-panel flex flex-1 flex-col p-5",
            isMe ? "shadow-[inset_3px_0_0_var(--me)]" : "shadow-[inset_3px_0_0_var(--you)]",
          )}
        >
          {checkIn.mood ? (
            <MoodPicker value={checkIn.mood} onChange={() => {}} readOnly size="sm" />
          ) : null}

          <p className="mt-3 text-[16px] leading-relaxed text-ink">
            「{checkIn.line}」
          </p>

          {checkIn.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={checkIn.imageUrl}
              alt=""
              className="mt-4 max-h-40 w-full rounded-[var(--radius-sm)] object-cover"
            />
          ) : null}

          <p className="mt-auto pt-4 text-[12px] text-ink-tertiary">
            {formatSyncTime(checkIn.updatedAt)} 已同步
            {isMe && checkIn.partnerReadAt
              ? " · 对方已读"
              : isMe
                ? " · 对方未读"
                : null}
            {isMe && hugFromPartner
              ? ` · TA 今天给过一个抱抱 · ${formatSyncTime(hugFromPartner.at)}`
              : null}
          </p>
        </div>
      )}
    </section>
  );
}
