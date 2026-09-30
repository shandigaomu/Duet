"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  clearEntryDraft,
  loadEntryDraft,
  saveEntryDraft,
} from "@/lib/entry-draft";
import {
  BODY_MAX,
  IMAGE_MAX,
  TITLE_MAX,
  type EntryDTO,
} from "@/lib/journal";
import { shanghaiDay } from "@/lib/space";
import { uploadImageFile } from "@/lib/upload-client";
import { inviteCollabAction } from "@/server/collab-actions";
import {
  createEntryAction,
  updateEntryAction,
} from "@/server/entry-actions";

type EntryFormProps = {
  mode: "create" | "edit";
  initial?: EntryDTO | null;
  /** 写新日记时用于 localStorage 草稿 */
  draftOwner?: { userId: string; spaceId: string } | null;
  /** P1-3：清单预填（title/body，仅一次，不与草稿叠加） */
  prefill?: { title: string; body: string } | null;
};

type ImageItem = {
  preview: string;
  file?: File | null;
  /** P1-4：上传进度（0-100，仅发布时逐张更新） */
  progress?: number;
  /** P1-4：上传失败标记（点击重试） */
  failed?: boolean;
};

export function EntryForm({
  mode,
  initial,
  draftOwner = null,
  prefill = null,
}: EntryFormProps) {
  const router = useRouter();
  const [day, setDay] = useState(initial?.day ?? shanghaiDay());
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? prefill?.body ?? "");
  const [visibility, setVisibility] = useState<"shared" | "private">(
    initial?.visibility ?? "shared",
  );
  const [images, setImages] = useState<ImageItem[]>(
    () =>
      initial?.images.map((i) => ({ preview: i.url, file: null })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [draftHint, setDraftHint] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [pending, startTransition] = useTransition();
  const hydrated = useRef(false);
  // P2-N8：邀请 TA 合写
  const [collab, setCollab] = useState(false);

  useEffect(() => {
    if (mode !== "create" || !draftOwner || hydrated.current) return;
    hydrated.current = true;
    // 延迟到渲染后恢复，避免同步 setState 触发级联渲染（react-hooks/set-state-in-effect）
    const t = window.setTimeout(() => {
      // P1-3：带预填时不用本地草稿（二选一，预填优先）
      if (prefill) {
        setDraftRestored(true);
        return;
      }
      const draft = loadEntryDraft(draftOwner.userId, draftOwner.spaceId);
      if (draft) {
        if (draft.body.trim() || draft.title.trim() || draft.imageUrls.length) {
          setDay(draft.day);
          setTitle(draft.title);
          setBody(draft.body);
          setImages(
            draft.imageUrls.map((url) => ({ preview: url, file: null })),
          );
          setDraftHint(true);
        }
      }
      setDraftRestored(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [mode, draftOwner, prefill]);

  useEffect(() => {
    if (mode !== "create" || !draftOwner || !draftRestored) return;
    const t = window.setTimeout(() => {
      const imageUrls = images
        .map((i) => i.preview)
        .filter(
          (u) =>
            u.startsWith("http://") ||
            u.startsWith("https://") ||
            u.startsWith("/api/files/"),
        );
      saveEntryDraft(draftOwner.userId, draftOwner.spaceId, {
        day,
        title,
        body,
        imageUrls,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [mode, draftOwner, draftRestored, day, title, body, images]);

  function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    const remain = IMAGE_MAX - images.length;
    if (remain <= 0) return;
    const next = [...images];
    for (const file of Array.from(files).slice(0, remain)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({ preview: URL.createObjectURL(file), file });
    }
    setImages(next);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const item = prev[index];
      if (item?.preview.startsWith("blob:")) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  // P1-4：拖拽排序（HTML5 DnD，拖到目标位互换）
  const dragIndex = useRef<number | null>(null);
  function onDragStart(i: number) {
    dragIndex.current = i;
  }
  function onDrop(i: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === i) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(i, 0, moved);
      return next;
    });
  }

  // P1-4：日期旁「按上海时间」+ 23:00–01:00 轻提示（本地日期 ≠ 上海日期时）
  const shanghaiToday = shanghaiDay();
  const [tzHint, setTzHint] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const now = new Date();
      const localHour = now.getHours();
      if (localHour >= 23 || localHour < 1) {
        const tomorrowSh = addDays(shanghaiToday, 1);
        setTzHint(
          `现在写会算到 ${localHour >= 23 ? tomorrowSh : shanghaiToday}（按上海时间）`,
        );
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [shanghaiToday]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const imageUrls: string[] = [];
      let failed: string | null = null;
      for (let i = 0; i < images.length; i++) {
        const item = images[i]!;
        if (!item.file) {
          if (
            item.preview.startsWith("http://") ||
            item.preview.startsWith("https://") ||
            item.preview.startsWith("/api/files/")
          ) {
            imageUrls.push(item.preview);
          }
          continue;
        }
        try {
          setImages((prev) =>
            prev.map((im, j) =>
              j === i ? { ...im, progress: 0, failed: false } : im,
            ),
          );
          const { url } = await uploadImageFile(item.file, "entry", (pct) => {
            setImages((prev) =>
              prev.map((im, j) => (j === i ? { ...im, progress: pct } : im)),
            );
          });
          imageUrls.push(url);
          setImages((prev) =>
            prev.map((im, j) =>
              j === i ? { ...im, preview: url, file: null, progress: 100 } : im,
            ),
          );
        } catch (e) {
          failed = e instanceof Error ? e.message : "图片上传失败";
          setImages((prev) =>
            prev.map((im, j) => (j === i ? { ...im, failed: true, progress: undefined } : im)),
          );
        }
      }
      if (failed) {
        setError(failed + "（点击失败缩略图重试）");
        return;
      }

      // P2-N8：勾了合写 → 走邀请合写（pending，对方今日页出现邀请卡）
      if (collab && mode === "create") {
        const res = await inviteCollabAction({
          day,
          title: title.trim() || null,
          body,
          imageUrls,
        });
        if (!res.ok || !res.entryId) {
          setError(res.error || "保存失败");
          return;
        }
        if (draftOwner) clearEntryDraft(draftOwner.userId, draftOwner.spaceId);
        router.push("/today");
        router.refresh();
        return;
      }

      const payload = {
        day,
        title: title.trim() || null,
        body,
        imageUrls,
        visibility,
      };
      const res =
        mode === "edit" && initial
          ? await updateEntryAction({ id: initial.id, ...payload })
          : await createEntryAction(payload);

      if (!res.ok || !res.entry) {
        setError(res.error || "保存失败");
        return;
      }
      if (mode === "create" && draftOwner) {
        clearEntryDraft(draftOwner.userId, draftOwner.spaceId);
      }
      router.push(`/journal/${res.entry.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center justify-between border-b border-line bg-bg/85 px-5 backdrop-blur-sm md:px-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[14px] text-ink-secondary hover:text-ink"
        >
          ← 返回
        </button>
        <Button
          className="h-9 px-4 text-[13px]"
          onClick={submit}
          disabled={pending || !body.trim()}
        >
          {pending ? "保存中…" : mode === "edit" ? "保存" : "发布"}
        </Button>
      </header>

      <main className="animate-enter mx-auto w-full max-w-[720px] px-5 py-6 md:px-8 md:py-8">
        {error ? (
          <p className="mb-4 text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {mode === "create" && draftHint ? (
          <p className="mb-3 text-[12px] text-ink-tertiary">已恢复本地草稿</p>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
            日期 · 按上海时间
          </span>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-11 w-full max-w-[220px] rounded-[var(--radius-sm)] border border-line-strong bg-bg-elevated px-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          {tzHint ? (
            <span className="mt-1.5 block text-[12px] text-signal">{tzHint}</span>
          ) : null}
        </label>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          placeholder="标题（可选）"
          maxLength={TITLE_MAX}
          className="mt-6 w-full border-0 border-b border-line bg-transparent pb-3 text-[18px] font-semibold text-ink placeholder:text-ink-tertiary focus:border-brand focus:outline-none"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
          placeholder="写下今天……"
          rows={12}
          maxLength={BODY_MAX}
          className="mt-6 w-full resize-none border-0 bg-transparent text-[15px] leading-[1.65] text-ink placeholder:text-ink-tertiary focus:outline-none"
        />
        <p className="mt-1 text-right text-[12px] text-ink-tertiary">
          {body.length}/{BODY_MAX}
        </p>

        <div className="mt-8 border-t border-line pt-6">
          <p className="text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
            图片 · 最多 {IMAGE_MAX} 张
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {images.map((item, i) => (
              <div
                key={`${item.preview}-${i}`}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                title="拖拽排序"
                className="relative size-16 cursor-grab overflow-hidden rounded-[var(--radius-md)] bg-white/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt=""
                  className="size-full object-cover"
                />
                {item.progress != null && item.progress < 100 ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-[10px] font-medium text-white">
                    {item.progress}%
                  </span>
                ) : null}
                {item.failed ? (
                  <button
                    type="button"
                    onClick={submit}
                    className="absolute inset-0 flex items-center justify-center bg-danger/60 text-white"
                    aria-label="重试上传"
                  >
                    <RotateCcw className="size-4" strokeWidth={2} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-ink/70 text-white"
                  aria-label="移除图片"
                >
                  <X className="size-3" strokeWidth={2} />
                </button>
              </div>
            ))}
            {images.length < IMAGE_MAX ? (
              <label className="flex size-16 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-line-strong text-ink-tertiary hover:border-brand hover:text-brand">
                <ImagePlus className="size-5" strokeWidth={1.75} />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    onPickImages(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>
          <p className="mt-4 text-[13px] text-ink-tertiary">可见性</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setVisibility("shared")}
              className={`rounded-[10px] px-3 py-1.5 text-[13px] ${
                visibility === "shared"
                  ? "bg-brand text-white"
                  : "bg-white/45 text-ink-secondary"
              }`}
            >
              共享
            </button>
            <button
              type="button"
              onClick={() => setVisibility("private")}
              className={`rounded-[10px] px-3 py-1.5 text-[13px] ${
                visibility === "private"
                  ? "bg-brand text-white"
                  : "bg-white/45 text-ink-secondary"
              }`}
            >
              仅自己
            </button>
            {mode === "create" ? (
              <button
                type="button"
                onClick={() => setCollab((v) => !v)}
                className={`rounded-[10px] px-3 py-1.5 text-[13px] ${
                  collab
                    ? "bg-you text-white"
                    : "bg-white/45 text-ink-secondary"
                }`}
                title="发布后对方今日页出现邀请卡，各自写一段"
              >
                ✍️ 邀请 TA 合写
              </button>
            ) : null}
          </div>
          {collab ? (
            <p className="mt-2 text-[12px] text-ink-tertiary">
              发布后进入 pending：对方在今日页写 TA 的段落，双方确认后合成一篇署名「我 + 你」的日记；
              7 天未完成自动流回普通日记。
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}

function addDays(day: string, delta: number) {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
