"use server";

import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { pickRecall, RECALL_MIN_AGE_DAYS, type RecallPick } from "@/lib/recall";
import { shanghaiDay } from "@/lib/space";

/**
 * P3-T5 一起看（回忆抽签）：
 * 候选 = 双方可见共享日记（shared / 未删 / 非 pending / 90 天前），
 * 种子 = hash(spaceId + today) → 双方同天必抽到同一篇。
 */
export async function loadTodayRecall(): Promise<RecallPick | null> {
  const ctx = await requirePaired();
  const today = shanghaiDay();
  // 90 天前（UTC 回退换算日期字符串，粒度足够）
  const [y, m, d] = today.split("-").map(Number);
  const minDay = new Date(Date.UTC(y!, m! - 1, d!) - RECALL_MIN_AGE_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const rows = await prisma.entry.findMany({
    where: {
      spaceId: ctx.membership.spaceId,
      visibility: "shared",
      deletedAt: null,
      collabStatus: { not: "pending" },
      day: { gte: `0000-01-01`, lt: minDay },
    },
    select: { id: true, day: true, title: true, body: true },
    orderBy: [{ day: "asc" }, { id: "asc" }],
    // 量级控制：取最早 500 篇足以构成回忆池；超出部分按稳定序天然公平
    take: 500,
  });

  return pickRecall(
    rows,
    ctx.membership.spaceId,
    today,
  );
}
