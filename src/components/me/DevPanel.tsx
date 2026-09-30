"use client";

import { useState } from "react";
import type { ErrorLogDTO } from "@/server/error-actions";

type DevPanelProps = {
  errors: ErrorLogDTO[];
  total: number;
};

function kindLabel(kind: string) {
  if (kind === "unhandledrejection") return "未处理 Promise";
  if (kind === "client-error") return "页面错误";
  return kind;
}

/** P0-3 开发者分组：仅展示自己空间相关的最近错误，30 天自动清理 */
export function DevPanel({ errors, total }: DevPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyDiagnostics() {
    const text = errors
      .map(
        (e) =>
          `[${e.createdAt}] ${kindLabel(e.kind)} @ ${e.route}\n${e.message}\n${e.stack ?? "(无栈)"}`,
      )
      .join("\n\n");
    await navigator.clipboard.writeText(
      `Duet 诊断信息（${total} 条，展示最近 ${errors.length} 条）\n\n${text}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div>
      {errors.length === 0 ? (
        <p className="mt-1 text-[13px] text-ink-tertiary">
          暂无错误记录，一切正常
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[12px] text-ink-tertiary">
              共 {total} 条（保留 30 天）
            </p>
            <button
              type="button"
              onClick={copyDiagnostics}
              className="text-[12px] font-medium text-brand"
            >
              {copied ? "已复制" : "复制诊断信息"}
            </button>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {errors.map((e) => {
              const open = openId === e.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 py-2.5 text-left"
                    onClick={() => setOpenId(open ? null : e.id)}
                  >
                    <span className="mt-0.5 shrink-0 text-[11px] text-ink-tertiary">
                      {new Date(e.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">
                        {e.message}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-tertiary">
                        {kindLabel(e.kind)} · {e.route}
                      </span>
                    </span>
                  </button>
                  {open && e.stack ? (
                    <pre className="mb-2 max-h-40 overflow-auto rounded-[10px] bg-white/40 px-3 py-2 text-[11px] leading-relaxed text-ink-secondary">
                      {e.stack}
                    </pre>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
