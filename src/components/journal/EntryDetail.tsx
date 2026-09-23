"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatDayShort, type EntryDTO } from "@/lib/journal";
import {
  deleteEntryAction,
  markEntryReadAction,
} from "@/server/entry-actions";
import { cn } from "@/lib/cn";

type EntryDetailProps = {
  entry: EntryDTO;
};

export function EntryDetail({ entry }: EntryDetailProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [slide, setSlide] = useState(0);
  const isMine = entry.authorSide === "me";
  const markedRef = useRef(false);

  useEffect(() => {
    if (isMine || markedRef.current) return;
    markedRef.current = true;
    void markEntryReadAction(entry.id);
  }, [entry.id, isMine]);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteEntryAction(entry.id);
      if (!res.ok) {
        setError(res.error || "删除失败");
        return;
      }
      router.push("/journal");
      router.refresh();
    });
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center justify-between border-b border-line bg-bg/85 px-5 backdrop-blur-sm md:px-8">
        <Link
          href="/journal"
          className="inline-flex items-center gap-1.5 text-[14px] text-ink-secondary hover:text-ink"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          返回
        </Link>
        <p className="text-[13px] text-ink-secondary">
          {formatDayShort(entry.day)} ·{" "}
          <span
            className={
              entry.authorSide === "me" ? "text-me" : "text-you"
            }
          >
            {entry.authorSide === "me" ? "我" : entry.authorNickname}
          </span>
          {isMine && entry.visibility === "private" ? (
            <span className="ml-1.5 text-[11px] text-ink-tertiary">仅自己</span>
          ) : null}
          {isMine && entry.partnerReadAt ? (
            <span className="ml-1.5 text-[11px] text-ink-tertiary">已读</span>
          ) : null}
        </p>
        {isMine ? (
          <div className="relative">
            <button
              type="button"
              className="rounded-[var(--radius-sm)] p-2 text-ink-secondary hover:bg-white/40 hover:text-ink"
              aria-label="更多"
              onClick={() => {
                setMenuOpen((o) => !o);
                setConfirmDelete(false);
              }}
            >
              <MoreHorizontal className="size-5" strokeWidth={1.75} />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 mt-1 w-36 overflow-hidden rounded-[var(--radius-md)] border border-line bg-bg-elevated shadow-[var(--shadow-sheet)]">
                <Link
                  href={`/journal/${entry.id}/edit`}
                  className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-ink hover:bg-white/50"
                  onClick={() => setMenuOpen(false)}
                >
                  <Pencil className="size-3.5" strokeWidth={1.75} />
                  编辑
                </Link>
                {!confirmDelete ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] text-danger hover:bg-white/50"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    删除
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] font-semibold text-danger hover:bg-white/50"
                    disabled={pending}
                    onClick={onDelete}
                  >
                    {pending ? "删除中…" : "确认删除"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="w-9" />
        )}
      </header>

      <main className="animate-enter mx-auto w-full max-w-[720px] px-5 py-6 md:px-8 md:py-8">
        {error ? (
          <p className="mb-4 text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <p
          className={cn(
            "text-[12px] font-medium tracking-[0.04em]",
            entry.authorSide === "me" ? "text-me" : "text-you",
          )}
        >
          {entry.authorSide === "me" ? "我" : entry.authorNickname}
        </p>
        {entry.title ? (
          <h1 className="mt-2 text-[22px] font-semibold text-ink">
            {entry.title}
          </h1>
        ) : null}
        <p className="mt-2 text-[13px] text-ink-secondary">{entry.day}</p>

        <p className="mt-8 whitespace-pre-wrap text-[15px] leading-[1.65] text-ink">
          {entry.body}
        </p>

        {entry.images.length > 0 ? (
          <div className="mt-8">
            <div className="overflow-hidden rounded-[var(--radius-md)] bg-white/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.images[slide]?.url}
                alt=""
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
            {entry.images.length > 1 ? (
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  className="text-[13px] text-ink-secondary disabled:opacity-40"
                  disabled={slide === 0}
                  onClick={() => setSlide((s) => Math.max(0, s - 1))}
                >
                  ← 上一张
                </button>
                <p className="text-[12px] text-ink-tertiary">
                  {slide + 1} / {entry.images.length}
                </p>
                <button
                  type="button"
                  className="text-[13px] text-ink-secondary disabled:opacity-40"
                  disabled={slide >= entry.images.length - 1}
                  onClick={() =>
                    setSlide((s) => Math.min(entry.images.length - 1, s + 1))
                  }
                >
                  下一张 →
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </>
  );
}
