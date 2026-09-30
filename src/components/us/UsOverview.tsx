"use client";

import Link from "next/link";
import {
  Dice5,
  Heart,
  ImageIcon,
  ListTodo,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Workbench } from "@/components/shell/Workbench";

type UsOverviewProps = {
  openListCount: number;
  photoCount: number;
  noteCount: number;
  letterCount: number;
};

const counts = {
  list: 0,
  album: 0,
  notes: 0,
  letters: 0,
  recall: 0,
};

const LINKS = [
  {
    href: "/us/lists",
    label: "清单",
    hint: (n: number) => `${n} 件待办`,
    icon: ListTodo,
    key: "list" as const,
  },
  {
    href: "/us/album",
    label: "相册",
    hint: (n: number) => `${n} 张`,
    icon: ImageIcon,
    key: "album" as const,
  },
  {
    href: "/us/notes",
    label: "悄悄话",
    hint: (n: number) => `${n} 条`,
    icon: MessageCircle,
    key: "notes" as const,
  },
  {
    href: "/us/letters",
    label: "时光信",
    hint: (n: number) => (n > 0 ? `${n} 封信` : "写给未来"),
    icon: Mail,
    key: "letters" as const,
  },
  {
    href: "/us/recall",
    label: "一起看",
    hint: () => "每天抽一篇旧日记",
    icon: Dice5,
    key: "recall" as const,
  },
];

export function UsOverview({
  openListCount,
  photoCount,
  noteCount,
  letterCount,
}: UsOverviewProps) {
  const liveCounts = {
    ...counts,
    list: openListCount,
    album: photoCount,
    notes: noteCount,
    letters: letterCount,
  };

  return (
    <Workbench
      eyebrow="Us · Together"
      title="我们"
      description="共同清单、相册、悄悄话与时光信。日子在「记录」里。"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {LINKS.map((item) => {
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
                  {item.hint(liveCounts[item.key])}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="mt-8 flex items-center gap-1.5 text-[12px] text-ink-tertiary">
        <Heart className="size-3.5" strokeWidth={1.75} />
        两人共用 · 轻量入口
      </p>
    </Workbench>
  );
}
