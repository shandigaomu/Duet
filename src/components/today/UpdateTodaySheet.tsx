"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MoodPicker } from "@/components/today/MoodPicker";
import {
  LINE_MAX,
  NOTE_MAX,
  type CheckIn,
  type MoodId,
} from "@/lib/checkin";
import { uploadImageFile } from "@/lib/upload-client";

type UpdateTodaySheetProps = {
  open: boolean;
  initial: CheckIn | null;
  onClose: () => void;
  onSave: (next: Omit<CheckIn, "partnerReadAt"> & { partnerReadAt: null }) => void;
  saving?: boolean;
};

export function UpdateTodaySheet({
  open,
  initial,
  onClose,
  onSave,
  saving = false,
}: UpdateTodaySheetProps) {
  if (!open) return null;

  return (
    <SheetBody
      key={initial?.updatedAt ?? "empty"}
      initial={initial}
      onClose={onClose}
      onSave={onSave}
      saving={saving}
    />
  );
}

type SheetBodyProps = {
  initial: CheckIn | null;
  onClose: () => void;
  onSave: (next: Omit<CheckIn, "partnerReadAt"> & { partnerReadAt: null }) => void;
  saving: boolean;
};

function SheetBody({ initial, onClose, onSave, saving }: SheetBodyProps) {
  const titleId = useId();
  const lineRef = useRef<HTMLInputElement>(null);
  const [mood, setMood] = useState<MoodId | null>(initial?.mood ?? null);
  const [line, setLine] = useState(initial?.line ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => lineRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function handleImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
    setImageFile(file);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = line.trim();
    if (!trimmed) {
      setError("请写一句今天");
      lineRef.current?.focus();
      return;
    }
    if (trimmed.length > LINE_MAX) {
      setError(`一句话最多 ${LINE_MAX} 字`);
      return;
    }
    if (note.length > NOTE_MAX) {
      setError(`想说的话最多 ${NOTE_MAX} 字`);
      return;
    }

    let finalUrl = imageUrl;
    if (imageFile) {
      setUploading(true);
      setError(null);
      try {
        const { url } = await uploadImageFile(imageFile, "checkin");
        finalUrl = url;
        if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
        setImageUrl(url);
        setImageFile(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "配图上传失败");
        setUploading(false);
        return;
      }
      setUploading(false);
    } else if (finalUrl?.startsWith("blob:")) {
      finalUrl = null;
    }

    onSave({
      mood,
      line: trimmed,
      note: note.trim(),
      imageUrl: finalUrl,
      updatedAt: new Date().toISOString(),
      partnerReadAt: null,
    });
  }

  const busy = saving || uploading;

  return (
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
        className="sheet-panel glass-sheet relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-[520px] flex-col rounded-t-[28px] md:rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/35 px-5 py-4 md:px-6 md:py-5">
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
              Today · Composer
            </p>
            <h2
              id={titleId}
              className="mt-1 font-display text-[26px] leading-tight tracking-[0.01em] text-ink"
            >
              更新今日
            </h2>
            <p className="mt-1 text-[13px] text-ink-secondary">
              写一句今天，可选心情、留言与配图
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pressable flex size-9 shrink-0 items-center justify-center rounded-full bg-white/45 text-ink-secondary hover:bg-white/70 hover:text-ink"
            aria-label="关闭"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="flex-1 space-y-4 px-5 py-5 md:px-6">
            <section className="glass-toolbar px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
                  心情 · 可选
                </p>
                <span className="text-[11px] text-ink-tertiary">表情点选可取消</span>
              </div>
              <div className="mt-3">
                <MoodPicker value={mood} onChange={setMood} />
              </div>
            </section>

            <section className="glass-toolbar px-4 py-3.5">
              <label className="block">
                <span className="text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
                  一句话 · 必填
                </span>
                <input
                  ref={lineRef}
                  value={line}
                  onChange={(e) => setLine(e.target.value.slice(0, LINE_MAX))}
                  maxLength={LINE_MAX}
                  placeholder="今天怎样？"
                  className="mt-2.5 h-11 w-full rounded-[12px] border border-white/50 bg-white/55 px-3 text-[15px] text-ink placeholder:text-ink-tertiary shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] outline-none transition-[border-color,box-shadow,background] focus:border-brand/40 focus:bg-white/75 focus:shadow-[0_0_0_4px_var(--brand-soft)]"
                />
                <span className="mt-1.5 block text-right text-[12px] text-ink-tertiary">
                  {line.length}/{LINE_MAX}
                </span>
              </label>
            </section>

            <section className="glass-toolbar px-4 py-3.5">
              <label className="block">
                <span className="text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
                  想说的话 · 可选
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                  maxLength={NOTE_MAX}
                  rows={4}
                  placeholder="多几行也没关系"
                  className="mt-2.5 w-full resize-none rounded-[12px] border border-white/50 bg-white/55 px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-tertiary shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] outline-none transition-[border-color,box-shadow,background] focus:border-brand/40 focus:bg-white/75 focus:shadow-[0_0_0_4px_var(--brand-soft)]"
                />
                <span className="mt-1.5 block text-right text-[12px] text-ink-tertiary">
                  {note.length}/{NOTE_MAX}
                </span>
              </label>
            </section>

            <section className="glass-toolbar px-4 py-3.5">
              <p className="text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
                配图 · 最多 1 张
              </p>
              {imageUrl ? (
                <div className="relative mt-3 overflow-hidden rounded-[16px] border border-white/45">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="今日配图预览"
                    className="max-h-48 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
                      setImageUrl(null);
                      setImageFile(null);
                    }}
                    className="absolute top-2 right-2 rounded-full bg-[rgba(18,21,26,0.55)] px-3 py-1 text-[12px] text-[#F5F6F4] backdrop-blur-sm"
                  >
                    移除
                  </button>
                </div>
              ) : (
                <label className="mt-3 flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-white/60 bg-white/30 text-ink-secondary transition-colors hover:border-brand/40 hover:bg-white/45 hover:text-brand">
                  <span className="flex size-10 items-center justify-center rounded-full bg-white/55 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]">
                    <ImagePlus className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="text-[13px]">加一张图</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleImage(e.target.files?.[0])}
                  />
                </label>
              )}
            </section>

            {error ? (
              <p className="text-[13px] text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-white/35 bg-white/25 px-5 py-4 backdrop-blur-xl md:px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              className="h-12 w-full rounded-[14px] text-[15px]"
              disabled={busy}
            >
              {uploading ? "上传配图…" : saving ? "同步中…" : "同步"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
