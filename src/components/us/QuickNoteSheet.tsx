"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Flame, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { NOTE_BODY_MAX } from "@/lib/note";
import { createNoteAction } from "@/server/note-actions";
import { useHeartbeat } from "@/lib/heartbeat";

const UNREAD_KEY = "duet.notes.lastSeen";

/**
 * P2-N7 悄悄话全局入口：
 * 桌面侧栏底部同位 / 移动端右下（清单 FAB 上方），点击弹轻 Sheet 发送。
 * 未读信号 = 对方在我上次查看悄悄话之后有新留言（P5-O2：用统一心跳检查，不再自起独立定时器）。
 */
export function QuickNoteButton({ partnerNickname }: { partnerNickname: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [burn, setBurn] = useState(false);
  const [unread, setUnread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentPulse, setSentPulse] = useState(false);
  const [pending, startTransition] = useTransition();

  async function check() {
    if (document.visibilityState !== "visible") return;
    try {
      const lastSeen = Number(localStorage.getItem(UNREAD_KEY) || 0);
      const res = await fetch(
        `/api/notes/unread?since=${encodeURIComponent(new Date(lastSeen).toISOString())}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { count: number };
      setUnread(data.count > 0);
    } catch {
      /* ignore */
    }
  }

  // P5-O2：未读检查改用统一心跳（模块级一条定时器，今日页上与今日全页刷新共用）
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });
  useHeartbeat(() => checkRef.current());
  // 原定时器的首拍改为挂载即查（不等第一拍）
  useEffect(() => {
    void checkRef.current();
  }, []);

  function openSheet() {
    try {
      localStorage.setItem(UNREAD_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setUnread(false);
    setOpen(true);
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await createNoteAction({ body, burnAfterReading: burn });
      if (!res.ok) {
        setError(res.error || "发送失败");
        return;
      }
      setBody("");
      setBurn(false);
      setOpen(false);
      setSentPulse(true);
      window.setTimeout(() => setSentPulse(false), 900);
      router.refresh();
    });
  }

  const sheet = open ? <NoteSheetBody
    body={body}
    setBody={setBody}
    burn={burn}
    setBurn={setBurn}
    error={error}
    pending={pending}
    onClose={() => setOpen(false)}
    onSend={send}
  /> : null;

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        title={`给 ${partnerNickname} 悄悄话`}
        aria-label="悄悄话"
        className={`fixed right-5 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+84px)] z-20 flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand shadow-[var(--shadow-glass)] transition-transform active:scale-90 md:hidden ${
          sentPulse ? "animate-[pulse_0.4s_ease-in-out_2]" : ""
        }`}
      >
        <Heart className="size-[18px]" strokeWidth={1.75} fill="currentColor" />
        {unread ? (
          <span className="signal-dot absolute right-1.5 top-1.5 size-2 rounded-full bg-signal" />
        ) : null}
      </button>
      {sheet && typeof document !== "undefined"
        ? createPortal(sheet, document.body)
        : null}
    </>
  );
}

function NoteSheetBody({
  body,
  setBody,
  burn,
  setBurn,
  error,
  pending,
  onClose,
  onSend,
}: {
  body: string;
  setBody: (v: string) => void;
  burn: boolean;
  setBurn: (fn: (v: boolean) => boolean) => void;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        className="sheet-overlay absolute inset-0 bg-[rgba(18,21,26,0.18)] backdrop-blur-md"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-panel glass-sheet relative z-10 w-full max-w-[440px] rounded-t-[28px] p-5 md:rounded-[28px] md:p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
              Quick whisper
            </p>
            <h2 id={titleId} className="mt-1 font-display text-[19px] text-ink">
              丢一句悄悄话
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-ink-secondary hover:bg-white/45"
            aria-label="关闭"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, NOTE_BODY_MAX))}
          rows={4}
          autoFocus
          placeholder="现在想说…"
          className="mt-4 w-full resize-none rounded-[14px] border border-line bg-white/45 px-3 py-2.5 text-[14px] outline-none focus:border-brand"
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-ink-tertiary">
              {body.length}/{NOTE_BODY_MAX}
            </span>
            {/* P3-T8：阅后即焚开关（与置顶互斥，服务端恻底） */}
            <button
              type="button"
              onClick={() => setBurn((v) => !v)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                burn
                  ? "border-signal bg-signal/10 text-signal"
                  : "border-line text-ink-tertiary hover:text-ink-secondary",
              )}
              aria-pressed={burn}
              title="对方读过后 24 小时自动消失，不进回收站"
            >
              <Flame className="size-3.5" strokeWidth={1.75} />
              阅后即焚
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="h-9 px-3" onClick={onClose}>
              取消
            </Button>
            <Button
              className="h-9 px-4"
              onClick={onSend}
              disabled={pending || !body.trim()}
            >
              {pending ? "发送中…" : "发送"}
            </Button>
          </div>
        </div>
        {error ? (
          <p className="mt-2 text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
