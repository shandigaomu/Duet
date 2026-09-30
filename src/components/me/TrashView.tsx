"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { Workbench } from "@/components/shell/Workbench";
import { Button } from "@/components/ui/Button";
import { formatDayShort } from "@/lib/journal";
import { formatSyncTime } from "@/lib/checkin";
import type { TrashItem } from "@/server/trash-actions";
import {
  purgeTrashItemAction,
  restoreTrashItemAction,
} from "@/server/trash-actions";

type TrashViewProps = {
  items: TrashItem[];
};

/** P2-N5：回收站（我的 → 回收站） */
export function TrashView({ items }: TrashViewProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function restore(item: TrashItem) {
    setError(null);
    startTransition(async () => {
      const res = await restoreTrashItemAction(item.kind, item.id);
      if (!res.ok) setError(res.error || "恢复失败");
      else router.refresh();
    });
  }

  function purge(item: TrashItem) {
    setError(null);
    if (purgingId !== item.id) {
      setPurgingId(item.id);
      return;
    }
    startTransition(async () => {
      const res = await purgeTrashItemAction(item.kind, item.id);
      setPurgingId(null);
      if (!res.ok) setError(res.error || "删除失败");
      else router.refresh();
    });
  }

  return (
    <Workbench
      eyebrow="Me · Trash"
      title="回收站"
      description="删错的日记和悄悄话在这里躺 30 天，随时可以捞回来。"
      action={
        <Link
          href="/me"
          className="inline-flex h-10 items-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          我的
        </Link>
      }
    >
      {error ? (
        <p className="mb-3 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <p className="font-display text-[18px] text-ink-secondary">
            回收站是空的
          </p>
          <p className="mt-2 text-[13px] text-ink-tertiary">
            删除的日记与悄悄话会先到这里
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="glass-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] tracking-[0.06em] text-ink-tertiary uppercase">
                    {item.kind === "entry"
                      ? `日记${item.day ? ` · ${formatDayShort(item.day)}` : ""}`
                      : "悄悄话"}
                  </p>
                  <p className="mt-1 truncate text-[15px] font-medium text-ink">
                    {item.title || item.preview}
                  </p>
                  {item.title ? (
                    <p className="mt-0.5 truncate text-[13px] text-ink-secondary">
                      {item.preview}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[12px] text-ink-tertiary">
                    删除于 {formatSyncTime(item.deletedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-[12px]"
                    onClick={() => restore(item)}
                    disabled={pending}
                  >
                    <RotateCcw className="size-3.5" strokeWidth={1.75} />
                    恢复
                  </Button>
                  <Button
                    variant="danger"
                    className="h-8 px-3 text-[12px]"
                    onClick={() => purge(item)}
                    disabled={pending}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    {purgingId === item.id ? "确认彻底删除" : "彻底删除"}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Workbench>
  );
}
