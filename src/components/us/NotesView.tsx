"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Pin, Trash2 } from "lucide-react";
import { Workbench } from "@/components/shell/Workbench";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { NOTE_BODY_MAX, type NoteDTO } from "@/lib/note";
import {
  createNoteAction,
  deleteNoteAction,
  pinNoteAction,
} from "@/server/note-actions";

type NotesViewProps = {
  notes: NoteDTO[];
  pinned: NoteDTO | null;
};

export function NotesView({ notes, pinned }: NotesViewProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createNoteAction({ body, parentId: replyTo });
      if (!res.ok) {
        setError(res.error || "发送失败");
        return;
      }
      setBody("");
      setReplyTo(null);
      router.refresh();
    });
  }

  function pin(id: string) {
    startTransition(async () => {
      await pinNoteAction(id);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm("删除这条悄悄话？")) return;
    startTransition(async () => {
      const res = await deleteNoteAction(id);
      if (!res.ok) setError(res.error || "删除失败");
      else router.refresh();
    });
  }

  return (
    <Workbench
      eyebrow="Us · Whispers"
      title="悄悄话"
      description="留一句、回一句；可以置顶一句给彼此。"
      action={
        <Link
          href="/us"
          className="inline-flex h-10 items-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          我们
        </Link>
      }
    >
      {pinned ? (
        <div className="mb-6 rounded-[14px] border border-brand/20 bg-brand-soft/40 px-4 py-3">
          <p className="text-[11px] font-medium tracking-[0.08em] text-brand uppercase">
            置顶
          </p>
          <p className="mt-1 text-[15px] text-ink">{pinned.body}</p>
          <p className="mt-1 text-[12px] text-ink-tertiary">
            {pinned.authorSide === "me" ? "我" : pinned.authorNickname}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mb-3 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-6">
        {replyTo ? (
          <p className="mb-2 text-[12px] text-ink-secondary">
            回复中{" "}
            <button
              type="button"
              className="text-brand"
              onClick={() => setReplyTo(null)}
            >
              取消
            </button>
          </p>
        ) : null}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, NOTE_BODY_MAX))}
          rows={3}
          placeholder="写一句悄悄话…"
          className="w-full resize-none rounded-[14px] border border-line bg-white/45 px-3 py-2.5 text-[14px] outline-none focus:border-brand"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[12px] text-ink-tertiary">
            {body.length}/{NOTE_BODY_MAX}
          </span>
          <Button
            className="h-9 px-4"
            onClick={submit}
            disabled={pending || !body.trim()}
          >
            发送
          </Button>
        </div>
      </div>

      <ul className="space-y-4">
        {notes.map((n) => (
          <li key={n.id} className="border-b border-line pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p
                  className={cn(
                    "text-[12px] font-medium",
                    n.authorSide === "me" ? "text-me" : "text-you",
                  )}
                >
                  {n.authorSide === "me" ? "我" : n.authorNickname}
                  {n.pinned ? " · 置顶" : ""}
                </p>
                <p className="mt-1 text-[15px] text-ink">{n.body}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => pin(n.id)}
                  className={cn(
                    "rounded p-1.5 text-ink-tertiary hover:text-brand",
                    n.pinned && "text-brand",
                  )}
                  aria-label={n.pinned ? "取消置顶" : "置顶"}
                >
                  <Pin className="size-3.5" strokeWidth={1.75} />
                </button>
                {n.authorSide === "me" ? (
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    className="rounded p-1.5 text-ink-tertiary hover:text-danger"
                    aria-label="删除"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="mt-2 text-[12px] text-brand"
              onClick={() => setReplyTo(n.id)}
            >
              回复
            </button>
            {n.replies.length > 0 ? (
              <ul className="mt-3 space-y-2 border-l border-line pl-3">
                {n.replies.map((r) => (
                  <li key={r.id}>
                    <p
                      className={cn(
                        "text-[11px] font-medium",
                        r.authorSide === "me" ? "text-me" : "text-you",
                      )}
                    >
                      {r.authorSide === "me" ? "我" : r.authorNickname}
                    </p>
                    <p className="text-[14px] text-ink-secondary">{r.body}</p>
                    {r.authorSide === "me" ? (
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="mt-0.5 text-[11px] text-ink-tertiary hover:text-danger"
                      >
                        删除
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {notes.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-ink-tertiary">
          还没有悄悄话
        </p>
      ) : null}
    </Workbench>
  );
}
