"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadImageFile } from "@/lib/upload-client";
import { LETTER_BODY_MAX, LETTER_TITLE_MAX } from "@/lib/letter";
import {
  createLetterAction,
  deleteLetterAction,
  updateLetterAction,
} from "@/server/letter-actions";

type LetterSheetProps = {
  open: boolean;
  mode: "create" | "edit";
  today: string;
  initial?: {
    id: string;
    title: string | null;
    body: string | null;
    imageUrl: string | null;
    unlockDay: string;
  } | null;
  onClose: () => void;
  onSaved: () => void;
};

/** P2-N3：写信/改信弹层（解锁日必填、不得早于今天；解锁后不可改） */
export function LetterSheet({
  open,
  mode,
  today,
  initial,
  onClose,
  onSaved,
}: LetterSheetProps) {
  if (!open) return null;
  return (
    <Body
      key={initial?.id ?? `new-${today}`}
      mode={mode}
      today={today}
      initial={initial}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function Body({
  mode,
  today,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  today: string;
  initial?: LetterSheetProps["initial"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const titleId = useId();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [unlockDay, setUnlockDay] = useState(initial?.unlockDay ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
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

  function pickImage(file: File) {
    setError(null);
    setUploading(true);
    void uploadImageFile(file, "entry")
      .then((res) => setImageUrl(res.url))
      .catch((err: Error) => setError(err.message || "图片上传失败"))
      .finally(() => setUploading(false));
  }

  function save() {
    setError(null);
    if (!unlockDay) {
      setError("选一个解锁的日子");
      return;
    }
    startTransition(async () => {
      const payload = {
        title: title.trim() || null,
        body: body.trim(),
        unlockDay,
        imageUrl,
      };
      const res =
        mode === "edit" && initial
          ? await updateLetterAction({ id: initial.id, ...payload })
          : await createLetterAction(payload);
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
      const res = await deleteLetterAction(initial.id);
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
              Time letter
            </p>
            <h2
              id={titleId}
              className="mt-1 font-display text-[19px] text-ink"
            >
              {mode === "edit" ? "改这封信" : "写一封时光信"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-ink-secondary hover:bg-white/45"
            aria-label="关闭"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 md:px-6">
          <label className="block">
            <span className="text-[12px] text-ink-secondary">
              标题（可选）
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, LETTER_TITLE_MAX))}
              placeholder="比如：给明年的你"
              className="mt-1.5 h-10 w-full rounded-[10px] border border-line bg-white/45 px-3 text-[14px] text-ink outline-none placeholder:text-ink-tertiary focus:border-brand"
            />
          </label>

          <label className="block">
            <span className="text-[12px] text-ink-secondary">正文</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, LETTER_BODY_MAX))}
              rows={7}
              placeholder="写给未来的 TA，也写给未来的自己…"
              className="mt-1.5 w-full resize-none rounded-[10px] border border-line bg-white/45 px-3 py-2.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-tertiary focus:border-brand"
            />
            <span className="mt-1 block text-right text-[11px] text-ink-tertiary">
              {body.length}/{LETTER_BODY_MAX}
            </span>
          </label>

          <label className="block">
            <span className="text-[12px] text-ink-secondary">
              解锁日（必填，当天才能打开）
            </span>
            <input
              type="date"
              min={today}
              value={unlockDay}
              onChange={(e) => setUnlockDay(e.target.value)}
              className="mt-1.5 h-10 w-full max-w-[200px] rounded-[10px] border border-line bg-white/45 px-3 text-[14px] text-ink outline-none focus:border-brand"
            />
          </label>

          <div>
            <span className="text-[12px] text-ink-secondary">附一张图（可选）</span>
            {imageUrl ? (
              <div className="relative mt-2 overflow-hidden rounded-[12px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="max-h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[11px] text-white"
                >
                  移除
                </button>
              </div>
            ) : (
              <label className="mt-2 flex cursor-pointer items-center justify-center rounded-[12px] border border-dashed border-line py-6 text-[13px] text-ink-tertiary hover:border-brand hover:text-brand">
                {uploading ? "上传中…" : "+ 添加图片"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) pickImage(file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {error ? (
            <p className="text-[13px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-white/35 px-5 py-4 md:px-6">
          {mode === "edit" ? (
            confirmDelete ? (
              <Button variant="danger" onClick={onDelete} disabled={pending}>
                确认删除
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                删除
              </Button>
            )
          ) : null}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            取消
          </Button>
          <Button onClick={save} disabled={pending || uploading}>
            {pending ? "封存中…" : "封存这封信"}
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}
