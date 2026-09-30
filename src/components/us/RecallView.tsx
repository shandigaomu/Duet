import Link from "next/link";
import { Dice5, Sparkles } from "lucide-react";
import { Workbench } from "@/components/shell/Workbench";
import type { RecallPick } from "@/lib/recall";

/** P3-T5 一起看（回忆抽签）：每天一篇，两人同天必同篇 */
export function RecallView({ recall }: { recall: RecallPick | null }) {
  return (
    <Workbench
      eyebrow="Us · Recall"
      title="一起看"
      description="每天抽一篇旧日记，两个人翻到同一页。"
    >
      {recall ? (
        <Link
          href={`/journal/${recall.entry.id}`}
          className="glass-panel block p-6 transition-colors hover:bg-white/40"
        >
          <div className="flex items-center gap-2 text-[12px] font-medium tracking-[0.04em] text-brand">
            <Dice5 className="size-4" strokeWidth={1.75} />
            {recall.yearsAgo} 年前的今天抽到的
          </div>
          <p className="mt-3 font-display text-[22px] text-ink">
            {recall.entry.title || "一篇没有标题的日记"}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
            {recall.preview}
          </p>
          <p className="mt-4 text-[12px] text-ink-tertiary">
            {recall.entry.day} · 池子里共有 {recall.poolSize} 篇回忆
          </p>
        </Link>
      ) : (
        <div className="glass-panel flex flex-col items-center gap-3 p-10 text-center">
          <Sparkles className="size-6 text-brand" strokeWidth={1.5} />
          <p className="font-display text-[18px] text-ink-secondary">
            回忆还在积累中
          </p>
          <p className="max-w-[320px] text-[13px] text-ink-tertiary">
            写满 90 天后，这里每天会为你们抽一篇共同的日记。
          </p>
        </div>
      )}

      <p className="mt-6 text-[12px] text-ink-tertiary">
        每天一篇 · 双方看到的是同一篇 · 明天自动换新
      </p>
    </Workbench>
  );
}
