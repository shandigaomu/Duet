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
};

export function PersonColumn({
  who,
  label,
  emptyHint,
  checkIn,
  unread = false,
  onEmptyClick,
  className,
}: PersonColumnProps) {
  const isMe = who === "me";

  return (
    <section className={cn("flex min-h-[200px] flex-col", className)}>
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <p
          className={cn(
            "text-[12px] font-medium tracking-[0.06em]",
            isMe ? "text-me" : "text-you",
          )}
        >
          {label}
        </p>
        {!isMe && checkIn && unread ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-signal">
            <span className="signal-dot size-1.5 rounded-full bg-signal" aria-hidden />
            未读
          </span>
        ) : null}
        {!isMe && checkIn && !unread ? (
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
          </p>
        </div>
      )}
    </section>
  );
}
