"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  joinSpaceAction,
  type ActionResult,
} from "@/server/space-actions";

export function JoinSpaceForm() {
  const [state, formAction, pending] = useActionState(
    joinSpaceAction,
    null as ActionResult | null,
  );

  return (
    <div className="animate-enter">
      <p className="font-display text-[22px] tracking-[0.02em] text-brand">Duet</p>
      <h1 className="mt-4 text-[22px] font-semibold text-ink">加入对方</h1>
      <p className="mt-2 text-[14px] text-ink-secondary">
        输入对方发来的邀请码完成绑定。一空间仅两人。
      </p>

      <form className="mt-8 space-y-4" action={formAction}>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
            昵称
          </span>
          <input
            name="nickname"
            required
            maxLength={40}
            className="field-glass h-11 w-full rounded-[var(--radius-sm)] px-3 text-[15px]"
            placeholder="你希望对方怎么称呼你"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
            邀请码
          </span>
          <input
            name="inviteCode"
            required
            maxLength={12}
            className="field-glass h-11 w-full rounded-[var(--radius-sm)] px-3 font-mono text-[16px] tracking-[0.12em] uppercase"
            placeholder="ABCDEF"
            autoCapitalize="characters"
          />
        </label>
        {state?.error ? (
          <p className="text-[13px] text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={pending}>
          {pending ? "绑定中…" : "确认绑定"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-secondary">
        想自己创建？{" "}
        <Link
          href="/create"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          创建空间
        </Link>
      </p>
    </div>
  );
}
