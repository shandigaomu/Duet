"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Delete } from "lucide-react";
import { unlockAppAction } from "@/server/lock-actions";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

/** P2-N6：锁屏（仅品牌 + 数字键盘，零业务数据） */
export function LockScreen() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function press(key: string) {
    if (pending) return;
    setError(null);
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      startTransition(async () => {
        const res = await unlockAppAction({ pin: next });
        if (!res.ok) {
          setError(res.error || "PIN 不对");
          setPin("");
          return;
        }
        router.replace("/today");
        router.refresh();
      });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 px-8">
      <div className="text-center">
        <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--accent)] uppercase">
          Duet
        </p>
        <h1 className="mt-3 font-display text-[26px] text-ink">
          {pending ? "解锁中…" : "这个小空间已上锁"}
        </h1>
      </div>

      <div className="flex items-center gap-4" aria-label="PIN 输入进度">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full border transition ${
              i < pin.length
                ? "border-brand bg-brand"
                : "border-line-strong bg-transparent"
            }`}
          />
        ))}
      </div>

      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-[13px] text-ink-tertiary">输入 4 位数字 PIN</p>
      )}

      <div className="grid grid-cols-3 gap-x-8 gap-y-4">
        {KEYS.map((key, i) =>
          key === "" ? (
            <span key={`gap-${i}`} />
          ) : key === "del" ? (
            <button
              key="del"
              type="button"
              onClick={() => press("del")}
              disabled={pending || pin.length === 0}
              className="flex size-16 items-center justify-center rounded-full text-ink-secondary hover:bg-white/40 disabled:opacity-30"
              aria-label="删除"
            >
              <Delete className="size-5" strokeWidth={1.5} />
            </button>
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              disabled={pending}
              className="size-16 rounded-full font-display text-[22px] text-ink transition hover:bg-white/45 active:scale-95 disabled:opacity-40"
            >
              {key}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={() => router.replace("/login")}
        className="text-[12px] text-ink-tertiary hover:text-ink-secondary"
      >
        用其他账号登录
      </button>
    </div>
  );
}
