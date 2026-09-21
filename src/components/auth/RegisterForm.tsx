"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim() || "Duet 用户";
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");

    const { error: err } = await authClient.signUp.email({
      name,
      email,
      password,
    });
    setPending(false);
    if (err) {
      setError(err.message || "注册失败");
      return;
    }
    router.replace("/create");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="animate-brand font-display text-[36px] tracking-[0.04em] text-brand">
        创建账号
      </h1>
      <p className="animate-soft mt-2 text-[14px] text-ink-secondary">
        邮箱 + 密码，至少 8 位
      </p>

      <form
        className="animate-soft mt-8 w-full space-y-3 text-left"
        style={{ animationDelay: "200ms" }}
        onSubmit={onSubmit}
      >
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
            昵称（可选）
          </span>
          <input
            type="text"
            name="name"
            maxLength={40}
            placeholder="之后还可在空间里设置"
            className="field-glass h-11 w-full rounded-[var(--radius-sm)] px-3 text-[15px]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium tracking-[0.04em] text-ink-secondary">
            邮箱
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="field-glass h-11 w-full rounded-[var(--radius-sm)] px-3 text-[15px]"
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
            autoComplete="new-password"
            placeholder="至少 8 位"
            className="field-glass h-11 w-full rounded-[var(--radius-sm)] px-3 text-[15px]"
          />
        </label>
        {error ? (
          <p className="text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="mt-4 w-full" type="submit" disabled={pending}>
          {pending ? "注册中…" : "注册"}
        </Button>
      </form>

      <p className="mt-8 text-[13px] text-ink-secondary">
        已有账号？{" "}
        <Link
          href="/login"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          登录
        </Link>
      </p>
    </div>
  );
}
