import Link from "next/link";
import { Heart } from "lucide-react";
import { Workbench } from "@/components/shell/Workbench";
import { formatDayShort } from "@/lib/journal";
import type { ReactionWallData } from "@/server/reaction-wall";

type ReactionWallViewProps = {
  data: ReactionWallData;
  partnerNickname: string;
};

/** P4-W10 回应墙「我们说过的话」：把对方留在我日记上的回应聚成一页。只读，不可删。 */
export function ReactionWallView({ data, partnerNickname }: ReactionWallViewProps) {
  return (
    <Workbench
      eyebrow="Us · Reaction Wall"
      title={`我们说过的话`}
      description={`${partnerNickname} 写在你日记上的回应，倒序排成一页。`}
      stats={[
        { label: "回应", value: data.total > 0 ? `${data.total} 句` : "0" },
        { label: "类型", value: "表情 + 一句话" },
        { label: "权限", value: "只读" },
      ]}
    >
      {data.items.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Heart className="size-8 text-brand-soft" strokeWidth={1.5} />
          <p className="text-[15px] text-ink-secondary">
            墙还是空的——先去写一篇，把「回应」留给对方
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="glass-panel px-4 py-3.5">
              <p className="flex items-baseline gap-2 text-[15px] leading-relaxed text-ink">
                <span aria-hidden>{r.emoji}</span>
                {r.body ? r.body : <span className="text-ink-secondary">（只有表情）</span>}
              </p>
              <Link
                href={`/journal/${r.entryId}`}
                className="mt-1.5 block text-[12px] text-ink-tertiary hover:text-brand"
              >
                {formatDayShort(r.entryDay)} · 我写的
                {r.entryTitle ? `《${r.entryTitle}》` : r.entryPreview ? `「${r.entryPreview}」` : ""}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data.truncated ? (
        <p className="mt-3 px-1 text-[12px] text-ink-tertiary">
          共 {data.total} 句，这里只展示最近的 100 句
        </p>
      ) : null}

      <p className="mt-6 flex items-center gap-1.5 text-[12px] text-ink-tertiary">
        <Heart className="size-3.5" strokeWidth={1.75} />
        写下的就留下 · 对方撤回即消失（如实）
      </p>
    </Workbench>
  );
}
