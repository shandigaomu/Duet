"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  buildHint,
  dayMarkSchema,
  nextOccurrence,
  splitUpcomingPast,
  type DayMarkDTO,
  type DayMarkHint,
} from "@/lib/daymark";
import { requirePaired } from "@/lib/guards";
import { shanghaiDay } from "@/lib/space";
import { shanghaiMonth } from "@/lib/journal";

type MembershipCtx = Awaited<ReturnType<typeof requirePaired>>;

function partnerOf(ctx: MembershipCtx) {
  return ctx.membership.space.members.find((m) => m.userId !== ctx.user.id);
}

function nicknameFor(authorId: string, ctx: MembershipCtx): string {
  if (authorId === ctx.user.id) return ctx.membership.nickname;
  return partnerOf(ctx)?.nickname ?? "你";
}

function toDTO(
  row: {
    id: string;
    day: string;
    title: string;
    note: string | null;
    yearly: boolean;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
  },
  ctx: MembershipCtx,
  today = shanghaiDay(),
): DayMarkDTO {
  return {
    id: row.id,
    day: row.day,
    title: row.title,
    note: row.note,
    yearly: row.yearly,
    authorId: row.authorId,
    authorSide: row.authorId === ctx.user.id ? "me" : "you",
    authorNickname: nicknameFor(row.authorId, ctx),
    nextDay: nextOccurrence(row.day, row.yearly, today),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type DayMarkActionResult = {
  ok: boolean;
  error?: string;
  mark?: DayMarkDTO;
};

export type LoadDaysPageResult = Awaited<
  ReturnType<typeof loadDaysPage>
>;

export async function loadDaysPage(opts?: {
  month?: string;
  selectedDay?: string;
}): Promise<{
  month: string;
  selectedDay: string;
  today: string;
  markedDays: string[];
  dayMarks: DayMarkDTO[];
  upcoming: DayMarkDTO[];
  past: DayMarkDTO[];
  partnerNickname: string;
  /** P0-2：系统合成的只读「在一起」周年标记（未设置纪念日时为 null） */
  anniversaryMark: DayMarkDTO | null;
  /** P2-N1：当月心情点（每条含 day/side/mood） */
  moodDots: Array<{
    day: string;
    side: "me" | "you";
    mood: "happy" | "ok" | "sad" | null;
  }>;
}> {
  const ctx = await requirePaired();
  const today = shanghaiDay();
  const currentMonth = shanghaiMonth();
  const month =
    opts?.month && /^\d{4}-\d{2}$/.test(opts.month)
      ? opts.month
      : currentMonth;
  const selectedDay =
    opts?.selectedDay && /^\d{4}-\d{2}-\d{2}$/.test(opts.selectedDay)
      ? opts.selectedDay
      : today.startsWith(month)
        ? today
        : `${month}-01`;

  const spaceId = ctx.membership.spaceId;
  const all = await prisma.dayMark.findMany({
    where: { spaceId },
    orderBy: [{ day: "asc" }, { createdAt: "asc" }],
  });

  // P2-N1：当月 CheckIn 心情（心情月历色点）
  const monthStart = `${month}-01`;
  const [y, mo] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(y!, mo!, 1) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const monthCheckIns = await prisma.checkIn.findMany({
    where: { spaceId, day: { gte: monthStart, lte: monthEnd } },
    select: { day: true, authorId: true, mood: true },
  });
  const moodDots = monthCheckIns.map((c) => ({
    day: c.day,
    side: (c.authorId === ctx.user.id ? "me" : "you") as "me" | "you",
    mood: (c.mood as "happy" | "ok" | "sad" | null) ?? null,
  }));

  let dtos: DayMarkDTO[] = all.map((r) => toDTO(r, ctx, today));

  // P0-2：纪念日 → 合成只读系统标记（不落库，不可改删）
  const anniversary = ctx.membership.space.anniversaryDay;
  const anniversaryMark: DayMarkDTO | null = anniversary
    ? {
        id: `system-anniversary`,
        day: anniversary,
        title: "在一起",
        note: null,
        yearly: true,
        authorId: "system",
        authorSide: "me",
        authorNickname: "Duet",
        nextDay: nextOccurrence(anniversary, true, today),
        createdAt: "",
        updatedAt: "",
      }
    : null;
  if (anniversaryMark) dtos = [anniversaryMark, ...dtos];

  const { upcoming, past } = splitUpcomingPast(dtos, today);

  // 当月色点：非周年看原 day；周年在当月出现则标当月对应日
  const marked = new Set<string>();
  for (const m of dtos) {
    if (m.day.startsWith(month)) marked.add(m.day);
    if (m.yearly) {
      const [, mm, dd] = m.day.split("-");
      const candidate = `${month.slice(0, 4)}-${mm}-${dd}`;
      if (candidate.startsWith(month)) marked.add(candidate);
      // next occurrence in this month view year
      if (m.nextDay.startsWith(month)) marked.add(m.nextDay);
    }
  }

  const dayMarks = dtos
    .filter((m) => {
      if (!m.yearly) return m.day === selectedDay;
      const [, mm, dd] = m.day.split("-");
      return selectedDay.slice(5) === `${mm}-${dd}`;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    month,
    selectedDay,
    today,
    markedDays: [...marked],
    dayMarks,
    upcoming,
    past,
    partnerNickname: partnerOf(ctx)?.nickname ?? "你",
    anniversaryMark,
    /** P2-N1：当月心情点（每条含 day/side/mood） */
    moodDots,
  };
}

export async function loadUpcomingHint(): Promise<DayMarkHint | null> {
  const ctx = await requirePaired();
  const today = shanghaiDay();
  const all = await prisma.dayMark.findMany({
    where: { spaceId: ctx.membership.spaceId },
  });
  const hints = all
    .map((r) =>
      buildHint(
        { id: r.id, title: r.title, day: r.day, yearly: r.yearly },
        today,
      ),
    )
    .filter((h): h is DayMarkHint => h != null)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.nextDay.localeCompare(b.nextDay));
  return hints[0] ?? null;
}

export async function createDayMarkAction(input: {
  day: string;
  title: string;
  note?: string | null;
  yearly?: boolean;
}): Promise<DayMarkActionResult> {
  const ctx = await requirePaired();
  const parsed = dayMarkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }

  const row = await prisma.dayMark.create({
    data: {
      spaceId: ctx.membership.spaceId,
      authorId: ctx.user.id,
      day: parsed.data.day,
      title: parsed.data.title,
      note: parsed.data.note?.trim() || null,
      yearly: parsed.data.yearly ?? false,
    },
  });

  revalidatePath("/journal/days");
  revalidatePath("/today");
  return { ok: true, mark: toDTO(row, ctx) };
}

export async function updateDayMarkAction(input: {
  id: string;
  day: string;
  title: string;
  note?: string | null;
  yearly?: boolean;
}): Promise<DayMarkActionResult> {
  const ctx = await requirePaired();
  const existing = await prisma.dayMark.findFirst({
    where: { id: input.id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "标记不存在" };

  const parsed = dayMarkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }

  const row = await prisma.dayMark.update({
    where: { id: existing.id },
    data: {
      day: parsed.data.day,
      title: parsed.data.title,
      note: parsed.data.note?.trim() || null,
      yearly: parsed.data.yearly ?? false,
    },
  });

  revalidatePath("/journal/days");
  revalidatePath("/today");
  return { ok: true, mark: toDTO(row, ctx) };
}

export async function deleteDayMarkAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const existing = await prisma.dayMark.findFirst({
    where: { id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "标记不存在" };

  await prisma.dayMark.delete({ where: { id } });
  revalidatePath("/journal/days");
  revalidatePath("/today");
  return { ok: true };
}
