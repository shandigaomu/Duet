"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/today";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");

    const { error: err } = await authClient.signIn.email({
      email,
      password,
    });
    setPending(false);
    if (err) {
      setError(err.message || "登录失败");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center text-center">
      <p className="animate-soft text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
        Private Space For Two
      </p>
      <h1 className="animate-brand mt-3 font-display text-[44px] tracking-[0.06em] text-brand sm:text-[48px]">
        Duet
      </h1>
      <p
        className="animate-soft mt-3 text-[15px] text-ink-secondary"
        style={{ animationDelay: "160ms" }}
      >
        两人的日常二重奏
      </p>

      <form
        className="animate-soft mt-8 w-full space-y-3 text-left"
        style={{ animationDelay: "320ms" }}
        onSubmit={onSubmit}
      >
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
            邮箱
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="field-glass h-11 w-full rounded-[var(--radius-sm)] px-3 text-[15px] text-ink placeholder:text-ink-tertiary"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
            密码
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="current-password"
            placeholder="至少 8 位"
            className="field-glass h-11 w-full rounded-[var(--radius-sm)] px-3 text-[15px] text-ink placeholder:text-ink-tertiary"
          />
        </label>
        {error ? (
          <p className="text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="mt-4 w-full" type="submit" disabled={pending}>
          {pending ? "进入中…" : "进入"}
        </Button>
      </form>

      <p
        className="animate-soft mt-8 text-[13px] text-ink-secondary"
        style={{ animationDelay: "480ms" }}
      >
        还没有账号？{" "}
        <Link
          href="/register"
          className="font-medium text-brand underline-offset-2 transition-opacity hover:underline hover:opacity-80"
        >
          注册
        </Link>
      </p>
    </div>
  );
}
