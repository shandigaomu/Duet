"use client";

import { cn } from "@/lib/cn";
import { MOODS, MOOD_BY_ID, type MoodId } from "@/lib/checkin";

type MoodPickerProps = {
  value: MoodId | null;
  onChange: (value: MoodId | null) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
};

export function MoodPicker({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: MoodPickerProps) {
  const current = value ? MOOD_BY_ID[value] : null;

  if (readOnly) {
    if (!current) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-white/45 px-2.5 py-1 text-ink",
          size === "sm" ? "text-[13px]" : "text-[14px]",
        )}
        role="img"
        aria-label={`心情 ${current.label}`}
      >
        <span className={size === "sm" ? "text-[16px] leading-none" : "text-[18px] leading-none"}>
          {current.emoji}
        </span>
        <span className="text-[12px] font-medium text-ink-secondary">
          {current.label}
        </span>
      </span>
    );
  }

  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label="心情（可选）"
    >
      {MOODS.map((mood) => {
        const selected = value === mood.id;
        return (
          <button
            key={mood.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={mood.label}
            onClick={() => onChange(selected ? null : mood.id)}
            className={cn(
              "pressable inline-flex min-w-[5.5rem] flex-1 items-center justify-center gap-2 rounded-[14px] border px-3 py-2.5 text-[13px] font-medium transition-colors",
              selected
                ? "border-brand/25 bg-brand text-[#F5F6F4] shadow-[0_8px_20px_rgba(31,74,69,0.22)]"
                : "border-white/55 bg-white/50 text-ink-secondary hover:bg-white/75 hover:text-ink",
            )}
          >
            <span className="text-[22px] leading-none" aria-hidden>
              {mood.emoji}
            </span>
            {mood.label}
          </button>
        );
      })}
    </div>
  );
}
