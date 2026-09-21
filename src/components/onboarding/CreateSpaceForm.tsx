"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  checkPairingReadyAction,
  createSpaceAction,
  type ActionResult,
} from "@/server/space-actions";

type Props = {
  initialInviteCode?: string | null;
  initialNickname?: string | null;
};

export function CreateSpaceForm({
  initialInviteCode = null,
  initialNickname = null,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createSpaceAction,
    null as ActionResult | null,
  );
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const inviteCode = state?.inviteCode || initialInviteCode;

  useEffect(() => {
    if (state?.ok && state.inviteCode) {
      router.refresh();
    }
  }, [state, router]);

  // 对方加入后自动进入今日（约 3s 轮询）
  useEffect(() => {
    if (!inviteCode) return;
    let cancelled = false;

    async function tick() {
      try {
        const res = await checkPairingReadyAction();
        if (cancelled) return;
        if (res.ready) {
          setChecking(true);
          router.replace("/today");
          router.refresh();
        }
      } catch {
        // 忽略单次失败，继续轮询
      }
    }

    void tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [inviteCode, router]);

  async function copyCode() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="animate-enter">
      <p className="font-display text-[22px] tracking-[0.02em] text-brand">Duet</p>
      <h1 className="mt-4 text-[22px] font-semibold text-ink">创建空间</h1>
      <p className="mt-2 text-[14px] text-ink-secondary">
        取一个昵称，生成邀请码发给对方。一空间仅两人。
      </p>

      {inviteCode ? (
        <div className="mt-8 space-y-4">
          {initialNickname ? (
            <p className="text-[14px] text-ink-secondary">
              你的昵称：
              <span className="font-medium text-ink">{initialNickname}</span>
            </p>
          ) : null}
          <div className="glass-toolbar px-4 py-4">
            <p className="text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
              邀请码
            </p>
            <p className="mt-2 font-mono text-[28px] tracking-[0.22em] text-ink">
              {inviteCode}
            </p>
            <p className="mt-2 text-[12px] text-ink-tertiary">
              {checking
                ? "对方已加入，正在进入…"
                : "发给对方，加入后将自动进入今日"}
            </p>
            <Button type="button" className="mt-4 w-full" onClick={copyCode}>
              {copied ? "已复制" : "复制邀请码"}
            </Button>
          </div>
          <p className="text-center text-[13px] text-ink-secondary">
            对方已有账号？让对方打开{" "}
            <Link
              href="/join"
              className="font-medium text-brand underline-offset-2 hover:underline"
            >
              加入空间
            </Link>
          </p>
        </div>
      ) : (
        <>
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
            {state?.error ? (
              <p className="text-[13px] text-danger" role="alert">
                {state.error}
              </p>
            ) : null}
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "生成中…" : "生成邀请码"}
            </Button>
          </form>
          <p className="mt-6 text-center text-[13px] text-ink-secondary">
            已有邀请码？{" "}
            <Link
              href="/join"
              className="font-medium text-brand underline-offset-2 hover:underline"
            >
              加入对方
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
