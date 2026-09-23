"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  Workbench,
  WorkbenchTab,
  WorkbenchToolbar,
} from "@/components/shell/Workbench";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  LIST_CATEGORIES,
  LIST_TITLE_MAX,
  type ListCategory,
  type ListItemDTO,
} from "@/lib/list";
import {
  completeListItemAction,
  createListItemAction,
  deleteListItemAction,
  reopenListItemAction,
} from "@/server/list-actions";

type ListsViewProps = {
  items: ListItemDTO[];
  initialCategory: ListCategory | "all";
  partnerNickname: string;
};

export function ListsView({
  items,
  initialCategory,
  partnerNickname,
}: ListsViewProps) {
  const router = useRouter();
  const [category, setCategory] = useState<ListCategory | "all">(initialCategory);
  const [title, setTitle] = useState("");
  const [addCat, setAddCat] = useState<ListCategory>("go");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function filter(next: ListCategory | "all") {
    setCategory(next);
    startTransition(() => {
      const qs = next === "all" ? "" : `?category=${next}`;
      router.push(`/us/lists${qs}`);
    });
  }

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await createListItemAction({ category: addCat, title });
      if (!res.ok) {
        setError(res.error || "添加失败");
        return;
      }
      setTitle("");
      router.refresh();
    });
  }

  function toggle(item: ListItemDTO) {
    startTransition(async () => {
      if (item.status === "open") {
        const archive = window.confirm("完成了！要归档到时间线吗？");
        await completeListItemAction({
          id: item.id,
          archiveToTimeline: archive,
        });
      } else {
        await reopenListItemAction(item.id);
      }
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm("删除这条清单？")) return;
    startTransition(async () => {
      await deleteListItemAction(id);
      router.refresh();
    });
  }

  const open = items.filter((i) => i.status === "open");
  const done = items.filter((i) => i.status === "done");

  return (
    <Workbench
      eyebrow="Us · Lists"
      title="清单"
      description="想去的、想吃的、想做的 —— 一起勾完。"
      action={
        <Link
          href="/us"
          className="inline-flex h-10 items-center gap-1.5 text-[13px] text-ink-secondary hover:text-ink"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          我们
        </Link>
      }
      toolbar={
        <WorkbenchToolbar>
          <WorkbenchTab
            active={category === "all"}
            disabled={pending}
            onClick={() => filter("all")}
          >
            全部
          </WorkbenchTab>
          {LIST_CATEGORIES.map((c) => (
            <WorkbenchTab
              key={c.id}
              active={category === c.id}
              disabled={pending}
              onClick={() => filter(c.id)}
            >
              {c.label}
            </WorkbenchTab>
          ))}
        </WorkbenchToolbar>
      }
    >
      {error ? (
        <p className="mb-3 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <select
          value={addCat}
          onChange={(e) => setAddCat(e.target.value as ListCategory)}
          className="h-10 rounded-[10px] border border-line bg-white/45 px-3 text-[13px] text-ink outline-none"
        >
          {LIST_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, LIST_TITLE_MAX))}
          placeholder="加一条…"
          maxLength={LIST_TITLE_MAX}
          className="h-10 min-w-[12rem] flex-1 rounded-[10px] border border-line bg-white/45 px-3 text-[14px] outline-none focus:border-brand"
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <Button
          className="h-10 px-3"
          onClick={add}
          disabled={pending || !title.trim()}
        >
          <Plus className="size-4" strokeWidth={2} />
        </Button>
      </div>

      <ul className="space-y-2">
        {open.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-[14px] bg-white/30 px-3 py-3"
          >
            <button
              type="button"
              onClick={() => toggle(item)}
              className="mt-0.5 size-5 shrink-0 rounded-full border border-line-strong"
              aria-label="完成"
              disabled={pending}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-ink">{item.title}</p>
              <p className="mt-0.5 text-[12px] text-ink-tertiary">
                {LIST_CATEGORIES.find((c) => c.id === item.category)?.label}
                {" · "}
                <span
                  className={
                    item.authorSide === "me" ? "text-me" : "text-you"
                  }
                >
                  {item.authorSide === "me" ? "我加的" : `${partnerNickname}加的`}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="text-ink-tertiary hover:text-danger"
              aria-label="删除"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>

      {done.length > 0 ? (
        <section className="mt-8">
          <p className="mb-3 text-[12px] font-medium tracking-[0.04em] text-ink-tertiary">
            已完成
          </p>
          <ul className="space-y-2 opacity-70">
            {done.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-[14px] px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] text-white",
                  )}
                  aria-label="重新打开"
                  disabled={pending}
                >
                  ✓
                </button>
                <p className="flex-1 text-[14px] text-ink-secondary line-through">
                  {item.title}
                </p>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="text-ink-tertiary hover:text-danger"
                  aria-label="删除"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-8 text-center text-[14px] text-ink-tertiary">
          还没有清单，加一条想一起做的事吧
        </p>
      ) : null}
    </Workbench>
  );
}
