"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import {
  Workbench,
  WorkbenchTab,
  WorkbenchToolbar,
} from "@/components/shell/Workbench";
import { formatDayShort } from "@/lib/journal";
import type { AlbumPhoto } from "@/server/album-actions";

type AlbumViewProps = {
  photos: AlbumPhoto[];
  nextCursor: string | null;
  partnerNickname: string;
  initialSource: "all" | "mine" | "yours";
};

export function AlbumView({
  photos: initialPhotos,
  nextCursor: initialNextCursor,
  partnerNickname,
  initialSource,
}: AlbumViewProps) {
  const router = useRouter();
  const [source, setSource] = useState(initialSource);
  const [photos, setPhotos] = useState<AlbumPhoto[]>(initialPhotos);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 无限滚动： IntersectionObserver 触底加载
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor || loadingMore || pending) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, loadingMore, pending]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (source !== "all") params.set("source", source);
      params.set("cursor", nextCursor);
      const res = await fetch(`/api/album?${params.toString()}`);
      const data = (await res.json()) as {
        ok?: boolean;
        photos?: AlbumPhoto[];
        nextCursor?: string | null;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.photos) return;
      setPhotos((prev) => [...prev, ...data.photos!]);
      setNextCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  function filter(next: "all" | "mine" | "yours") {
    setSource(next);
    startTransition(() => {
      const qs = next === "all" ? "" : `?source=${next}`;
      router.push(`/us/album${qs}`);
    });
  }

  // 灯箱翻到已加载末尾前 3 张时预取下一页
  useEffect(() => {
    if (lightbox == null || !nextCursor || loadingMore) return;
    if (lightbox >= photos.length - 3) void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, photos.length]);

  useEffect(() => {
    if (lightbox == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight" && lightbox != null) {
        setLightbox((i) =>
          i == null ? null : Math.min(photos.length - 1, i + 1),
        );
      }
      if (e.key === "ArrowLeft" && lightbox != null) {
        setLightbox((i) => (i == null ? null : Math.max(0, i - 1)));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, photos.length]);

  const current = lightbox != null ? photos[lightbox] : null;

  return (
    <>
      <Workbench
        eyebrow="Us · Album"
        title="相册"
        description="日记里的照片，按时间聚在一起。"
        action={
          <Link
            href="/us"
            className="inline-flex h-10 items-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.75} />
            我们
          </Link>
        }
        toolbar={
          <WorkbenchToolbar>
            <WorkbenchTab
              active={source === "all"}
              disabled={pending}
              onClick={() => filter("all")}
            >
              全部
            </WorkbenchTab>
            <WorkbenchTab
              active={source === "mine"}
              disabled={pending}
              onClick={() => filter("mine")}
            >
              我的
            </WorkbenchTab>
            <WorkbenchTab
              active={source === "yours"}
              disabled={pending}
              onClick={() => filter("yours")}
            >
              {partnerNickname}
            </WorkbenchTab>
          </WorkbenchToolbar>
        }
      >
        {photos.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-ink-tertiary">
            还没有照片，写日记时加上图片吧
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:gap-2">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="aspect-square overflow-hidden bg-white/20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
            {nextCursor ? (
              <div
                ref={sentinelRef}
                className="flex h-16 items-center justify-center text-[12px] text-ink-tertiary"
              >
                {loadingMore ? "加载中…" : ""}
              </div>
            ) : (
              <p className="mt-4 text-center text-[12px] text-ink-tertiary">
                共 {photos.length} 张
              </p>
            )}
          </>
        )}
      </Workbench>

      {current && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[90] flex flex-col bg-[rgba(18,21,26,0.88)]">
              <div className="flex items-center justify-between px-4 py-3 text-white">
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="rounded-full p-2 hover:bg-white/10"
                  aria-label="关闭"
                >
                  <X className="size-5" strokeWidth={1.75} />
                </button>
                <p className="text-[13px] text-white/80">
                  {formatDayShort(current.day)} ·{" "}
                  {current.authorSide === "me" ? "我" : current.authorNickname}
                  {current.title ? ` · ${current.title}` : ""}
                </p>
                <Link
                  href={`/journal/${current.entryId}`}
                  className="text-[13px] text-white/90 underline-offset-2 hover:underline"
                >
                  看日记
                </Link>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.url}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
