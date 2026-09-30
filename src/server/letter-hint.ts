"use server";

import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { daysUntilUnlock } from "@/lib/letter";
import { shanghaiDay } from "@/lib/space";

/**
 * P3-T4：今日页信件倒计时提示。
 * 最近一封未解锁信（收信方 title 置 null 不泄露）；多封只取最近一封。
 */
export async function loadTodayLetterHint(): Promise<{
  unlockDay: string;
  title: string | null;
  daysLeft: number;
} | null> {
  const ctx = await requirePaired();
  const today = shanghaiDay();
  const row = await prisma.letter.findFirst({
    where: {
      spaceId: ctx.membership.spaceId,
      unlockDay: { gte: today },
    },
    orderBy: { unlockDay: "asc" },
    select: { unlockDay: true, title: true, authorId: true },
  });
  if (!row) return null;
  const isMine = row.authorId === ctx.user.id;
  return {
    unlockDay: row.unlockDay,
    title: isMine ? row.title : null,
    daysLeft: daysUntilUnlock(row.unlockDay, today),
  };
}
