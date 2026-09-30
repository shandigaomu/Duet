"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  disableAppLockAction,
  enableAppLockAction,
  lockNowAction,
} from "@/server/lock-actions";

type AppLockPanelProps = {
  enabled: boolean;
  unlocked: boolean;
};

const BACKGROUND_LOCK_KEY = "duet.lock.bgAt";
const BACKGROUND_LOCK_MS = 5 * 60 * 1000;

/** P2-N6：隐私锁设置（我的页） */
export function AppLockPanel({ enabled, unlocked }: AppLockPanelProps) {
  const router = useRouter();
  const [setupOpen, setSetupOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [confirmOff, setConfirmOff] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 后台超 5 分钟 → 前端主动上锁（Page Visibility）
  useEffect(() => {
    if (!enabled || !unlocked) return;
    function onVisibility() {
      if (document.visibilityState === "visible") {
        let bgAt = 0;
        try {
          bgAt = Number(localStorage.getItem(BACKGROUND_LOCK_KEY) || 0);
        } catch {
          /* ignore */
        }
        if (bgAt && Date.now() - bgAt > BACKGROUND_LOCK_MS) {
          void lockNowAction().then(() => router.refresh());
        }
        try {
          localStorage.removeItem(BACKGROUND_LOCK_KEY);
        } catch {
          /* ignore */
        }
      } else {
        try {
          localStorage.setItem(BACKGROUND_LOCK_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, unlocked, router]);

  function enable() {
    setError(null);
    startTransition(async () => {
      const res = await enableAppLockAction({ pin, pinConfirm });
      if (!res.ok) {
        setError(res.error || "设置失败");
        return;
      }
      setSetupOpen(false);
      setPin("");
      setPinConfirm("");
      setMessage("已开启，本页将立即进入上锁状态");
      router.refresh();
    });
  }

  function disable() {
    setError(null);
    startTransition(async () => {
      const res = await disableAppLockAction();
      if (!res.ok) {
        setError(res.error || "关闭失败");
        return;
      }
      setConfirmOff(false);
      setMessage("已关闭隐私锁");
      router.refresh();
    });
  }

  function lockNow() {
    startTransition(async () => {
      await lockNowAction();
      router.replace("/lock");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] text-ink">隐私锁</p>
          <p className="mt-0.5 text-[12px] text-ink-tertiary">
            {enabled
              ? unlocked
                ? "已开启 · 本设备已解锁（12 小时内免验证）"
                : "已开启"
              : "4 位 PIN，锁在服务端；别人拿不到也看不了"}
          </p>
        </div>
        {enabled ? (
          <Button
            variant="ghost"
            className="h-8 shrink-0 px-3 text-[12px]"
            onClick={lockNow}
            disabled={pending}
          >
            立即上锁
          </Button>
        ) : null}
      </div>

      {!enabled ? (
        setupOpen ? (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-[12px] text-ink-secondary">
                输入 4 位 PIN
              </span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="mt-1.5 h-10 w-32 rounded-[10px] border border-line bg-white/45 px-3 font-mono text-[18px] tracking-[0.4em] text-ink outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="text-[12px] text-ink-secondary">再输一遍</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="mt-1.5 h-10 w-32 rounded-[10px] border border-line bg-white/45 px-3 font-mono text-[18px] tracking-[0.4em] text-ink outline-none focus:border-brand"
              />
            </label>
            <div className="flex items-center gap-2">
              <Button
                className="h-9 px-4 text-[13px]"
                onClick={enable}
                disabled={pending || pin.length !== 4 || pinConfirm.length !== 4}
              >
                {pending ? "开启中…" : "开启并上锁"}
              </Button>
              <Button
                variant="ghost"
                className="h-9 px-3 text-[13px]"
                onClick={() => {
                  setSetupOpen(false);
                  setPin("");
                  setPinConfirm("");
                }}
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="mt-3 h-9 px-4 text-[13px]"
            onClick={() => setSetupOpen(true)}
          >
            开启隐私锁
          </Button>
        )
      ) : confirmOff ? (
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="danger"
            className="h-9 px-4 text-[13px]"
            onClick={disable}
            disabled={pending}
          >
            确认关闭
          </Button>
          <Button
            variant="ghost"
            className="h-9 px-3 text-[13px]"
            onClick={() => setConfirmOff(false)}
          >
            取消
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          className="mt-3 h-9 px-4 text-[13px]"
          onClick={() => setConfirmOff(true)}
          disabled={pending}
        >
          关闭隐私锁
        </Button>
      )}

      {message ? (
        <p className="mt-2 text-[12px] text-brand">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
