"use server";

import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { shanghaiWeekRange } from "@/lib/journal";
import {
  aggregateWeeklyMood,
  recentWeekStarts,
  weeklyMoodSummary,
  WEEKLY_MOOD_WEEKS,
  type WeeklyMoodRow,
  type WeeklyMoodWeek,
} from "@/lib/checkin";

export type WeeklyMoodData = {
  weeks: WeeklyMoodWeek[];
  togetherDaysThisWeek: number;
  togetherWeeksStreak: number;
  partnerNickname: string;
};

/** P1-2：近 8 周心情周报（内存聚合，量级极小） */
export async function loadWeeklyMood(): Promise<WeeklyMoodData> {
  const ctx = await requirePaired();
  const { start } = shanghaiWeekRange();
  const windowStart = recentWeekStarts(start, WEEKLY_MOOD_WEEKS)[0]!;
  const partner = ctx.membership.space.members.find(
    (m) => m.userId !== ctx.user.id,
  );

  const rows = await prisma.checkIn.findMany({
    where: {
      spaceId: ctx.membership.spaceId,
      day: { gte: windowStart },
    },
    select: { day: true, authorId: true, mood: true },
  });

  const moodRows: WeeklyMoodRow[] = rows.map((r) => ({
    day: r.day,
    authorIsMe: r.authorId === ctx.user.id,
    mood: r.mood,
  }));

  const weeks = aggregateWeeklyMood(moodRows, start, WEEKLY_MOOD_WEEKS);
  const summary = weeklyMoodSummary(weeks);

  return {
    weeks,
    togetherDaysThisWeek: summary.togetherDaysThisWeek,
    togetherWeeksStreak: summary.togetherWeeksStreak,
    partnerNickname: partner?.nickname ?? "你",
  };
}
