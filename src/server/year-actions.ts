"use server";

import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { yearSchema } from "@/lib/keywords";
import { topKeywords } from "@/lib/keywords";
import { shanghaiDay } from "@/lib/space";
import { entryVisibleWhere } from "@/lib/entry-shared";

export type YearInReview = {
  year: string;
  /** 可选年份列表（最早日记年到当年），用于切换 */
  years: string[];
  /** 共同记录天数（当天有任一今日同步记一行） */
  recordDays: number;
  /** 日记篇数（双方可见口径，私密排除） */
  entryCount: number;
  /** 完成清单项 */
  doneListCount: number;
  /** 互给抱抱总次数 */
  hugCount: number;
  /** 最常写日记的月份（null = 全年没写） */
  topMonth: string | null;
  /** 心情分布（me/you × happy/ok/sad） */
  mood: {
    me: { happy: number; ok: number; sad: number };
    you: { happy: number; ok: number; sad: number };
  };
  /** 年度关键词（<3 个 = 安静空态，前端处理） */
  keywords: string[];
  /** 最早一篇日记回链 */
  earliest: { id: string; day: string; title: string | null } | null;
};

function yearWhere(year: string) {
  return { day: { gte: `${year}-01-01`, lte: `${year}-12-31` } };
}

export async function loadYearInReview(opts?: {
  year?: string | null;
}): Promise<YearInReview> {
  const ctx = await requirePaired();
  const spaceId = ctx.membership.spaceId;
  const year = yearSchema.safeParse(opts?.year).success && opts?.year
    ? opts.year
    : shanghaiDay().slice(0, 4);

  const thisYearVisible = {
    spaceId,
    deletedAt: null,
    collabStatus: { not: "pending" },
    AND: [entryVisibleWhere(ctx.user.id), yearWhere(year)],
  };

  const [
    earliestRow,
    checkInRows,
    entryCount,
    doneListCount,
    hugCount,
    entryRows,
    listRows,
    moodRows,
  ] = await Promise.all([
    // 最早一篇可见日记 + 可选年份起点
    prisma.entry.findFirst({
      where: { spaceId, deletedAt: null, collabStatus: { not: "pending" }, AND: [entryVisibleWhere(ctx.user.id)] },
      orderBy: [{ day: "asc" }, { createdAt: "asc" }],
      select: { id: true, day: true, title: true },
    }),
    prisma.checkIn.findMany({
      where: { spaceId, AND: [yearWhere(year)] },
      select: { day: true, authorId: true },
    }),
    prisma.entry.count({ where: thisYearVisible }),
    prisma.listItem.count({
      where: {
        spaceId,
        status: "done",
        completedAt: {
          gte: new Date(`${year}-01-01T00:00:00+08:00`),
          lte: new Date(`${year}-12-31T23:59:59+08:00`),
        },
      },
    }),
    prisma.checkInHug.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01T00:00:00+08:00`),
          lte: new Date(`${year}-12-31T23:59:59+08:00`),
        },
        checkIn: { spaceId },
      },
    }),
    // 关键词 + 月份统计：标题 + 清单标题内存算（既有 week 亦如此）
    prisma.entry.findMany({
      where: thisYearVisible,
      select: { title: true, day: true, authorId: true },
    }),
    prisma.listItem.findMany({
      where: { spaceId, completedAt: {
        gte: new Date(`${year}-01-01T00:00:00+08:00`),
        lte: new Date(`${year}-12-31T23:59:59+08:00`),
      } },
      select: { title: true, status: true },
    }),
    prisma.checkIn.findMany({
      where: { spaceId, AND: [yearWhere(year)] },
      select: { mood: true, authorId: true },
    }),
  ]);

  // 共同记录天数（去重日）
  const recordDays = new Set(checkInRows.map((r) => r.day)).size;

  // 最常写日记的月份（0 篇 = null）
  const monthCount = new Map<string, number>();
  for (const row of entryRows) {
    const m = row.day.slice(0, 7);
    monthCount.set(m, (monthCount.get(m) ?? 0) + 1);
  }
  const topMonth =
    [...monthCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    null;

  // 心情分布（me/you 双色 × 三档）
  const me = { happy: 0, ok: 0, sad: 0 };
  const you = { happy: 0, ok: 0, sad: 0 };
  for (const row of moodRows) {
    if (row.mood !== "happy" && row.mood !== "ok" && row.mood !== "sad") continue;
    const bucket = row.authorId === ctx.user.id ? me : you;
    bucket[row.mood] += 1;
  }

  // 年度关键词：标题 2-gram + 清单标题
  const titles = [
    ...entryRows.map((r) => r.title || ""),
    ...listRows.filter((r) => r.status === "done").map((r) => r.title),
  ].filter((t) => t.length > 0);
  const keywords = topKeywords(titles, 5).map((k) => k.text);

  // 可选年份：最早日记年起 → 当年
  const startYear = earliestRow ? earliestRow.day.slice(0, 4) : year;
  const currentYear = shanghaiDay().slice(0, 4);
  const years: string[] = [];
  for (let y = Number(currentYear); y >= Number(startYear) && years.length < 10; y--) {
    years.push(String(y));
  }

  return {
    year,
    years,
    recordDays,
    entryCount,
    doneListCount,
    hugCount,
    topMonth,
    mood: { me, you },
    keywords,
    earliest: earliestRow
      ? { id: earliestRow.id, day: earliestRow.day, title: earliestRow.title }
      : null,
  };
}
