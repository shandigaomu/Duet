"use client";

import { createPortal } from "react-dom";
import { useId } from "react";
import { BookOpen, Check, Archive } from "lucide-react";
import { categoryLabel, type ListItemDTO } from "@/lib/list";

type CompleteListSheetProps = {
  item: ListItemDTO;
  pending: boolean;
  onClose: () => void;
  onPick: (choice: "done" | "archive" | "diary") => void;
};

/** P1-3：勾选完成时的三选弹层（替代 window.confirm） */
export function CompleteListSheet({
  item,
  pending,
  onClose,
  onPick,
}: CompleteListSheetProps) {
  const titleId = useId();

  const choices: {
    id: "done" | "archive" | "diary";
    icon: typeof Check;
    title: string;
    hint: string;
  }[] = [
    { id: "done", icon: Check, title: "仅完成", hint: "标记完成，不留痕" },
    {
      id: "archive",
      icon: Archive,
      title: "完成并归档时间线",
      hint: "生成一条清单日记快照",
    },
    {
      id: "diary",
      icon: BookOpen,
      title: "完成并写日记",
      hint: "预填草稿，续写后发布",
    },
  ];

  const sheet = (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-6">
      <button
        type="button"
        className="sheet-overlay absolute inset-0 bg-[rgba(18,21,26,0.18)] backdrop-blur-md"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-panel glass-sheet relative z-10 w-full max-w-[420px] rounded-t-[28px] px-5 py-5 md:rounded-[28px] md:px-6"
      >
        <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
          Done
        </p>
        <h2
          id={titleId}
          className="mt-1 font-display text-[22px] leading-tight text-ink"
        >
          完成了「{item.title}」
        </h2>
        <p className="mt-1 text-[13px] text-ink-secondary">
          {categoryLabel(item.category)}
        </p>

        <div className="mt-5 space-y-2">
          {choices.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                disabled={pending}
                onClick={() => onPick(c.id)}
                className="flex w-full items-start gap-3 rounded-[14px] bg-white/40 px-4 py-3 text-left transition-colors hover:bg-white/65 disabled:opacity-50"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-ink">
                    {c.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-tertiary">
                    {c.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="mt-4 w-full py-2 text-center text-[13px] text-ink-tertiary hover:text-ink-secondary"
        >
          还没完成
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
