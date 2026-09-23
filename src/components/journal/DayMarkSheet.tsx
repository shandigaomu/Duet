"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DAYMARK_NOTE_MAX,
  DAYMARK_TITLE_MAX,
  type DayMarkDTO,
} from "@/lib/daymark";
import {
  createDayMarkAction,
  deleteDayMarkAction,
  updateDayMarkAction,
} from "@/server/daymark-actions";

type DayMarkSheetProps = {
  open: boolean;
  mode: "create" | "edit";
  initialDay: string;
  initial?: DayMarkDTO | null;
  onClose: () => void;
  onSaved: () => void;
};

export function DayMarkSheet({
  open,
  mode,
  initialDay,
  initial,
  onClose,
  onSaved,
}: DayMarkSheetProps) {
  if (!open) return null;

  return (
    <Body
      key={initial?.id ?? `new-${initialDay}`}
      mode={mode}
      initialDay={initialDay}
      initial={initial}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function Body({
  mode,
  initialDay,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initialDay: string;
  initial?: DayMarkDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const titleId = useId();
  const [day, setDay] = useState(initial?.day ?? initialDay);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [yearly, setYearly] = useState(initial?.yearly ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function save() {
    setError(null);
    startTransition(async () => {
      const payload = {
        day,
        title: title.trim(),
        note: note.trim() || null,
        yearly,
      };
      const res =
        mode === "edit" && initial
          ? await updateDayMarkAction({ id: initial.id, ...payload })
          : await createDayMarkAction(payload);
      if (!res.ok) {
        setError(res.error || "保存失败");
        return;
      }
      onSaved();
      onClose();
    });
  }

  function onDelete() {
    if (!initial) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteDayMarkAction(initial.id);
      if (!res.ok) {
        setError(res.error || "删除失败");
        return;
      }
      onSaved();
      onClose();
    });
  }

  const sheet = (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
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
        className="sheet-panel glass-sheet relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-[480px] flex-col rounded-t-[28px] md:rounded-[28px]"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/35 px-5 py-4 md:px-6">
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
              Day mark
            </p>
            <h2
              id={titleId}
              className="mt-1 font-display text-[26px] leading-tight text-ink"
            >
              {mode === "edit" ? "编辑标记" : "标记一天"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-white/45 text-ink-secondary"
            aria-label="关闭"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 md:px-6">
          <label className="block">
            <span className="text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
              日期
            </span>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="mt-2 h-11 w-full rounded-[var(--radius-sm)] border border-line-strong bg-white/55 px-3 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
              标题
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, DAYMARK_TITLE_MAX))}
              maxLength={DAYMARK_TITLE_MAX}
              placeholder="去看海 / 在一起…"
              className="mt-2 h-11 w-full rounded-[var(--radius-sm)] border border-line-strong bg-white/55 px-3 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
              备注（可选）
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, DAYMARK_NOTE_MAX))}
              maxLength={DAYMARK_NOTE_MAX}
              rows={3}
              className="mt-2 w-full resize-none rounded-[var(--radius-sm)] border border-line-strong bg-white/55 px-3 py-2.5 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>

          <label className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-white/35 px-3 py-3">
            <input
              type="checkbox"
              checked={yearly}
              onChange={(e) => setYearly(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            <span className="text-[14px] text-ink">
              周年 · 每年同月同日重复
            </span>
          </label>

          {error ? (
            <p className="text-[13px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 border-t border-white/35 bg-white/25 px-5 pt-4 backdrop-blur-xl md:px-6 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
          <Button
            className="h-12 w-full"
            onClick={save}
            disabled={pending || !title.trim()}
          >
            {pending ? "保存中…" : "保存"}
          </Button>
          {mode === "edit" && initial ? (
            !confirmDelete ? (
              <button
                type="button"
                className="h-10 w-full text-[13px] text-danger"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
              >
                删除标记
              </button>
            ) : (
              <button
                type="button"
                className="h-10 w-full text-[13px] font-semibold text-danger"
                onClick={onDelete}
                disabled={pending}
              >
                {pending ? "删除中…" : "确认删除"}
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
