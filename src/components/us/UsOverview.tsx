"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import {
  CalendarClock,
  Dice5,
  ImageIcon,
  ListTodo,
  Mail,
  MessageCircle,
  MessageCircleHeart,
  Target,
} from "lucide-react";
import { Workbench } from "@/components/shell/Workbench";

type UsOverviewProps = {
  openListCount: number;
  photoCount: number;
  noteCount: number;
  letterCount: number;
  /** P3-T11：进行中目标数（0 = 显示「从立一个目标开始」） */
  activeGoalCount: number;
  /** P4-W10：TA 留在我的日记上的回应数 */
  reactionCount: number;
};

const zeroCounts = {
  list: 0,
  album: 0,
  notes: 0,
  letters: 0,
  recall: 0,
  goals: 0,
  year: 0,
  reactions: 0,
};

type CountKey = keyof typeof zeroCounts;

type EntryCard = {
  href: string;
  label: string;
  hint: (n: number) => string;
  icon: typeof ListTodo;
  key: CountKey;
};

/** P5-O5：入口按使用频率分两行——日常（天天可能碰）与仪式（低频、时点性） */
const DAILY_LINKS: EntryCard[] = [
  {
    href: "/us/lists",
    label: "清单",
    hint: (n: number) => `${n} 件待办`,
    icon: ListTodo,
    key: "list",
  },
  {
    href: "/us/album",
    label: "相册",
    hint: (n: number) => `${n} 张`,
    icon: ImageIcon,
    key: "album",
  },
  {
    href: "/us/notes",
    label: "悄悄话",
    hint: (n: number) => `${n} 条`,
    icon: MessageCircle,
    key: "notes",
  },
];

const RITUAL_LINKS: EntryCard[] = [
  {
    href: "/us/letters",
    label: "时光信",
    hint: (n: number) => (n > 0 ? `${n} 封信` : "写给未来"),
    icon: Mail,
    key: "letters",
  },
  {
    href: "/us/goals",
    label: "目标",
    hint: (n: number) => (n > 0 ? `${n} 个进行中` : "正在一起推进的事"),
    icon: Target,
    key: "goals",
  },
  {
    href: "/us/recall",
    label: "一起看",
    hint: () => "每天抽一篇旧日记",
    icon: Dice5,
    key: "recall",
  },
  {
    href: "/us/year",
    label: "年度回顾",
    hint: () => "一年的回忆一屏看完",
    icon: CalendarClock,
    key: "year",
  },
  {
    href: "/us/reactions",
    label: "回应墙",
    hint: (n: number) => (n > 0 ? `${n} 句写在你的日记里` : "我们说过的话"),
    icon: MessageCircleHeart,
    key: "reactions",
  },
];

function CardRow({
  items,
  counts,
}: {
  items: EntryCard[];
  counts: Record<CountKey, number>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="glass-panel flex flex-col gap-3 p-5 transition-colors hover:bg-white/40"
          >
            <Icon className="size-5 text-brand" strokeWidth={1.75} />
            <div>
              <p className="text-[17px] font-semibold text-ink">{item.label}</p>
              <p className="mt-1 text-[13px] text-ink-secondary">
                {item.hint(counts[item.key])}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function UsOverview({
  openListCount,
  photoCount,
  noteCount,
  letterCount,
  activeGoalCount,
  reactionCount,
}: UsOverviewProps) {
  const liveCounts = {
    ...zeroCounts,
    list: openListCount,
    album: photoCount,
    notes: noteCount,
    letters: letterCount,
    goals: activeGoalCount,
    reactions: reactionCount,
  };

  return (
    <Workbench
      eyebrow="Us · Together"
      title="我们"
      description="共同清单、相册、悄悄话与时光信。日子在「记录」里。"
    >
      <CardRow items={DAILY_LINKS} counts={liveCounts} />

      <p className="mt-7 text-[11px] font-medium tracking-[0.14em] text-ink-tertiary uppercase">
        仪式
      </p>
      <div className="mt-3">
        <CardRow items={RITUAL_LINKS} counts={liveCounts} />
      </div>

      <p className="mt-8 flex items-center gap-1.5 text-[12px] text-ink-tertiary">
        <Heart className="size-3.5" strokeWidth={1.75} />
        两人共用 · 轻量入口
      </p>
    </Workbench>
  );
}
