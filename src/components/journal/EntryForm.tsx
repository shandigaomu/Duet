"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, X } from "lucide-react";
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
import { resolveImageUrls } from "@/lib/upload-client";
import {
  createEntryAction,
  updateEntryAction,
} from "@/server/entry-actions";

type EntryFormProps = {
  mode: "create" | "edit";
  initial?: EntryDTO | null;
  /** 写新日记时用于 localStorage 草稿 */
  draftOwner?: { userId: string; spaceId: string } | null;
};

type ImageItem = {
  preview: string;
  file?: File | null;
};

export function EntryForm({
  mode,
  initial,
  draftOwner = null,
}: EntryFormProps) {
  const router = useRouter();
  const [day, setDay] = useState(initial?.day ?? shanghaiDay());
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
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

  useEffect(() => {
    if (mode !== "create" || !draftOwner || hydrated.current) return;
    hydrated.current = true;
    const draft = loadEntryDraft(draftOwner.userId, draftOwner.spaceId);
    if (!draft) {
      setDraftRestored(true);
      return;
    }
    if (draft.body.trim() || draft.title.trim() || draft.imageUrls.length) {
      setDay(draft.day);
      setTitle(draft.title);
      setBody(draft.body);
      setImages(draft.imageUrls.map((url) => ({ preview: url, file: null })));
      setDraftHint(true);
    }
    setDraftRestored(true);
  }, [mode, draftOwner]);

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

  function submit() {
    setError(null);
    startTransition(async () => {
      let imageUrls: string[];
      try {
        imageUrls = await resolveImageUrls(images, "entry");
      } catch (e) {
        setError(e instanceof Error ? e.message : "图片上传失败");
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
            日期
          </span>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-11 w-full max-w-[220px] rounded-[var(--radius-sm)] border border-line-strong bg-bg-elevated px-3 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
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
                className="relative size-16 overflow-hidden rounded-[var(--radius-md)] bg-white/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt=""
                  className="size-full object-cover"
                />
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
          </div>
        </div>
      </main>
    </>
  );
}
