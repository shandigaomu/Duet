"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Report = {
  route: string;
  kind: string;
  message: string;
  stack?: string;
};

const FLUSH_MS = 5_000;
/** 同 message+路由 1 分钟内去重 */
const DEDUP_MS = 60_000;
const MAX_BUFFER = 20;

let buffer: Report[] = [];
let timer: number | null = null;
const recent = new Map<string, number>();

function flush() {
  timer = null;
  if (buffer.length === 0) return;
  const reports = buffer;
  buffer = [];
  try {
    const payload = JSON.stringify({ reports });
    // sendBeacon：页面关闭也能发出；失败静默
    if (!navigator.sendBeacon?.("/api/errors", new Blob([payload], { type: "application/json" }))) {
      void fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // 静默
  }
}

function enqueue(report: Report) {
  // dev 环境只打 console，不入库
  if (process.env.NODE_ENV !== "production") return;

  const key = `${report.route}|${report.message}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUP_MS) return;
  recent.set(key, now);
  if (recent.size > 100) {
    const oldest = [...recent.entries()].sort((a, b) => a[1] - b[1])[0];
    if (oldest) recent.delete(oldest[0]);
  }

  buffer.push(report);
  if (buffer.length >= MAX_BUFFER) {
    flush();
    return;
  }
  if (timer == null) {
    timer = window.setTimeout(flush, FLUSH_MS);
  }
}

/** P0-3 全局错误上报：onerror + unhandledrejection，sendBeacon 批量上报 */
export function ErrorReporter() {
  const pathname = usePathname();

  useEffect(() => {
    function onError(message: string, source: string | undefined, lineno: number | undefined) {
      enqueue({
        route: pathname || "/",
        kind: "client-error",
        message: String(message).slice(0, 300),
        stack: source ? `${source}:${lineno ?? 0}` : undefined,
      });
    }
    function onUnhandled(e: PromiseRejectionEvent) {
      const reason = e.reason;
      enqueue({
        route: pathname || "/",
        kind: "unhandledrejection",
        message:
          (reason instanceof Error ? reason.message : String(reason)).slice(0, 300),
        stack:
          reason instanceof Error && reason.stack
            ? reason.stack.slice(0, 2000)
            : undefined,
      });
    }

    const errorHandler = (e: ErrorEvent) => {
      onError(e.message, e.filename, e.lineno);
    };
    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", onUnhandled);
      // 卸载前尽力发出
      flush();
    };
  }, [pathname]);

  return null;
}
