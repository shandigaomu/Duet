"use server";

import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { firstLinePreview } from "@/lib/journal";

export type ReactionWallItem = {
  id: string;
  emoji: string;
  body: string | null;
  entryId: string;
  entryDay: string;
  entryTitle: string | null;
  entryPreview: string;
  createdAt: string;
};

export type ReactionWallData = {
  items: ReactionWallItem[];
  /** 回应总数（虽列表封顶 100，计数如实展示） */
  total: number;
  /** 回应是否被截断（> 100 条时如实说明） */
  truncated: boolean;
};

const WALL_LIMIT = 100;

/**
 * P4-W10 回应墙「我们说过的话」：对方给我日记写的全部回应（作者不可回应自己，
 * 落在某人日记上的回应天然只属于另一半）。倒序；被软删的日记其回应不出现。
 * 不可删不可回应——写下的就留下；对方撤回即消失，如实。
 */
export async function loadReactionWall(): Promise<ReactionWallData> {
  const ctx = await requirePaired();
  const entryWhere = {
    spaceId: ctx.membership.spaceId,
    authorId: ctx.user.id,
    deletedAt: null,
  };

  const [rows, total] = await Promise.all([
    prisma.entryReaction.findMany({
      where: { entry: entryWhere },
      include: { entry: { select: { id: true, day: true, title: true, body: true } } },
      orderBy: { createdAt: "desc" },
      take: WALL_LIMIT,
    }),
    prisma.entryReaction.count({ where: { entry: entryWhere } }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      emoji: r.emoji,
      body: r.body,
      entryId: r.entry.id,
      entryDay: r.entry.day,
      entryTitle: r.entry.title,
      entryPreview: firstLinePreview(r.entry.body),
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    truncated: total > WALL_LIMIT,
  };
}
