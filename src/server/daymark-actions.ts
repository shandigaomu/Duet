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

  const dtos = all.map((r) => toDTO(r, ctx, today));
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
