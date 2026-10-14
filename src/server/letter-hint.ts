"use server";

import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { daysUntilUnlock } from "@/lib/letter";
import { shanghaiDay } from "@/lib/space";
import { notifyLettersTouch } from "@/server/letter-notify";

/**
 * P3-T4：今日页信件倒计时提示。
 * 最近一封未解锁信（收信方 title 置 null 不泄露）；多封只取最近一封。
 * P5-O4：今日页到访顺带触发时光信两条「访问触发」提醒（解锁当天 / 前夜）——
 * 今日页是最高频页面，写信方几乎天天到访，提醒从「碰巧进信页」变成「最迟
 * 当天打开今日页就到」。去重与文案在 letter-notify 内统一。
 */
export async function loadTodayLetterHint(): Promise<{
  unlockDay: string;
  title: string | null;
  daysLeft: number;
} | null> {
  const ctx = await requirePaired();
  const today = shanghaiDay();
  const partner = ctx.membership.space.members.find(
    (m) => m.userId !== ctx.user.id,
  );
  // 倒计时取最近一封；去重触发需要本日全部候选（unlocking/前夜都在 gte today 内）
  const rows = await prisma.letter.findMany({
    where: {
      spaceId: ctx.membership.spaceId,
      unlockDay: { gte: today },
    },
    orderBy: [{ unlockDay: "asc" }, { createdAt: "desc" }],
    take: 10,
  });

  notifyLettersTouch({
    rows,
    today,
    viewerId: ctx.user.id,
    partnerId: partner?.userId ?? null,
  });

  const row = rows[0];
  if (!row) return null;
  const isMine = row.authorId === ctx.user.id;
  return {
    unlockDay: row.unlockDay,
    title: isMine ? row.title : null,
    daysLeft: daysUntilUnlock(row.unlockDay, today),
  };
}
