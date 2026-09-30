import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/**
 * V3-N1：本设备推送通知开关。
 * 开 = 请求系统通知权限 + 保存订阅；关 = 取消本设备订阅。
 */
export function PushToggle() {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = 未知
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !vapidKey
      ) {
        if (alive) setEnabled(false);
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (alive) setEnabled(Boolean(sub));
      } catch {
        if (alive) setEnabled(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [vapidKey]);

  async function subscribe() {
    setError(null);
    if (!vapidKey) {
      setError("推送未配置");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("未获得系统通知权限");
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.ready);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setEnabled(true);
    } catch {
      setError("开启失败，请稍后再试");
    }
  }

  function unsubscribe() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe().catch(() => undefined);
        }
      } finally {
        setEnabled(false);
      }
    });
  }

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(vapidKey);

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-[15px] text-ink">即时通知（本设备）</p>
        <p className="mt-0.5 text-[12px] text-ink-tertiary">
          {supported
            ? "今日更新、新日记、清单完成等动态会推送到这台设备"
            : "此浏览器或环境不支持推送"}
        </p>
        {error ? (
          <p className="mt-1 text-[12px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={enabled === null || pending}
        onClick={() => (enabled ? unsubscribe() : void subscribe())}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition ${
          enabled
            ? "bg-brand-soft text-brand"
            : "border border-line text-ink-secondary hover:border-brand hover:text-brand"
        } disabled:opacity-50`}
      >
        {enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
        {enabled === null ? "…" : enabled ? "已开启" : "开启"}
      </button>
    </div>
  );
}

type EmailPrefState = {
  emailEnabled: boolean;
  emailWeekly: boolean;
};

/** V3-N2：邮件通知开关（即时邮件 + 周摘要） */
export function EmailToggle({ email }: { email: string }) {
  const [state, setState] = useState<EmailPrefState | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    fetch("/api/notify-pref")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { emailEnabled?: boolean; emailWeekly?: boolean } | null) => {
        if (alive && data) {
          setState({
            emailEnabled: Boolean(data.emailEnabled),
            emailWeekly: Boolean(data.emailWeekly),
          });
        } else if (alive) {
          setState({ emailEnabled: false, emailWeekly: false });
        }
      })
      .catch(() => {
        if (alive) setState({ emailEnabled: false, emailWeekly: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  function update(patch: Partial<EmailPrefState>) {
    if (!state) return;
    const next = { ...state, ...patch };
    setState(next); // 乐观
    startTransition(async () => {
      const res = await fetch("/api/notify-pref", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) setState(state); // 回滚
    });
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] text-ink">邮件通知</p>
          <p className="mt-0.5 truncate text-[12px] text-ink-tertiary">
            发到 {email}
          </p>
        </div>
        <button
          type="button"
          disabled={state === null || pending}
          onClick={() => update({ emailEnabled: !state?.emailEnabled })}
          className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-medium transition ${
            state?.emailEnabled
              ? "bg-brand-soft text-brand"
              : "border border-line text-ink-secondary hover:border-brand hover:text-brand"
          } disabled:opacity-50`}
        >
          {state === null ? "…" : state.emailEnabled ? "已开启" : "开启"}
        </button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-secondary">
        <input
          type="checkbox"
          className="size-4 accent-[#1f4a45]"
          checked={state?.emailWeekly ?? false}
          disabled={state === null || pending}
          onChange={(e) => update({ emailWeekly: e.target.checked })}
        />
        每周一上午发一封上周小结
      </label>
    </div>
  );
}
