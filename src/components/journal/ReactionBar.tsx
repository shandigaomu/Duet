"use client";

import { useState, useTransition } from "react";
import {
  REACTION_BODY_MAX,
  REACTION_EMOJIS,
  type EntryDTO,
} from "@/lib/journal";
import {
  deleteEntryReactionAction,
  upsertEntryReactionAction,
} from "@/server/entry-actions";
import { cn } from "@/lib/cn";

type ReactionBarProps = {
  entry: EntryDTO;
};

/** P0-1 日记回应：作者看对方回应，对方编辑自己的回应；一条日记限一条/人 */
export function ReactionBar({ entry }: ReactionBarProps) {
  const isAuthor = entry.authorSide === "me";
  const mine = entry.myReaction;
  const [editing, setEditing] = useState(false);
  const [emoji, setEmoji] = useState<string>(mine?.emoji ?? "❤️");
  const [body, setBody] = useState(mine?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await upsertEntryReactionAction({
        entryId: entry.id,
        emoji,
        body,
      });
      if (!res.ok) {
        setError(res.error || "回应失败");
        return;
      }
      setEditing(false);
    });
  }

  function withdraw() {
    setError(null);
    startTransition(async () => {
      await deleteEntryReactionAction(entry.id);
      setEditing(false);
      setBody("");
    });
  }

  // 作者视角：看对方的回应（或空态）
  if (isAuthor) {
    const r = entry.partnerReaction;
    return (
      <section className="mt-8 border-t border-line pt-5">
        <p className="text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
          TA 的回应
        </p>
        {r ? (
          <div className="mt-3 flex items-start gap-3 rounded-[14px] bg-white/35 px-4 py-3">
            <span className="text-[20px] leading-none">{r.emoji}</span>
            {r.body ? (
              <p className="flex-1 text-[14px] leading-relaxed text-ink">
                {r.body}
              </p>
            ) : (
              <p className="flex-1 text-[13px] text-ink-tertiary">轻轻回了一个表情</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-ink-tertiary">还没有回应</p>
        )}
      </section>
    );
  }

  // 回应者视角：已回应展示卡片（可改可撤），未回应显示入口
  if (!editing && mine) {
    return (
      <section className="mt-8 border-t border-line pt-5">
        <p className="text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
          我的回应
        </p>
        <div className="mt-3 flex items-start gap-3 rounded-[14px] bg-white/35 px-4 py-3">
          <span className="text-[20px] leading-none">{mine.emoji}</span>
          {mine.body ? (
            <p className="flex-1 text-[14px] leading-relaxed text-ink">
              {mine.body}
            </p>
          ) : (
            <p className="flex-1 text-[13px] text-ink-tertiary">只有表情</p>
          )}
          <div className="flex shrink-0 gap-2 text-[12px]">
            <button
              type="button"
              className="font-medium text-brand"
              onClick={() => {
                setEmoji(mine.emoji);
                setBody(mine.body ?? "");
                setEditing(true);
              }}
              disabled={pending}
            >
              修改
            </button>
            <button
              type="button"
              className="text-ink-tertiary hover:text-danger"
              onClick={withdraw}
              disabled={pending}
            >
              撤回
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-2 text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  if (!editing) {
    return (
      <section className="mt-8 border-t border-line pt-5">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
            写下你的回应
          </p>
          <button
            type="button"
            className="text-[13px] font-medium text-brand"
            onClick={() => setEditing(true)}
          >
            回应
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 border-t border-line pt-5">
      <p className="text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
        选择一个表情
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REACTION_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            aria-pressed={emoji === e}
            className={cn(
              "flex size-11 items-center justify-center rounded-full text-[20px] transition-all",
              emoji === e
                ? "scale-110 bg-brand-soft ring-2 ring-brand/50"
                : "bg-white/40 hover:bg-white/65",
            )}
          >
            {e}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, REACTION_BODY_MAX))}
        rows={2}
        maxLength={REACTION_BODY_MAX}
        placeholder="想说什么都可以（可选）"
        className="mt-3 w-full resize-none rounded-[12px] border border-line bg-white/45 px-3 py-2.5 text-[14px] leading-relaxed text-ink placeholder:text-ink-tertiary outline-none focus:border-brand/40"
      />
      <p className="mt-1 text-right text-[12px] text-ink-tertiary">
        {body.length}/{REACTION_BODY_MAX}
      </p>
      {error ? (
        <p className="mb-2 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-medium text-[#F5F6F4] disabled:opacity-60"
        >
          {pending ? "保存中…" : "发送回应"}
        </button>
        {mine ? (
          <button
            type="button"
            onClick={withdraw}
            disabled={pending}
            className="text-[12px] text-ink-tertiary hover:text-danger"
          >
            撤回
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-[12px] text-ink-tertiary hover:text-ink-secondary"
        >
          取消
        </button>
      </div>
    </section>
  );
}
