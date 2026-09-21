"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import {
  BODY_MAX,
  IMAGE_MAX,
  TITLE_MAX,
  previewBody,
  shanghaiMonth,
  type CheckInSnapshotItem,
  type EntryDTO,
  type EntryListItem,
  type TimelineFilter,
  type TimelineItem,
  type TimelineStats,
} from "@/lib/journal";
import { shanghaiDay } from "@/lib/space";

type MembershipCtx = Awaited<ReturnType<typeof requirePaired>>;

function partnerOf(ctx: MembershipCtx) {
  return ctx.membership.space.members.find((m) => m.userId !== ctx.user.id);
}

function sideOf(
  authorId: string,
  userId: string,
): "me" | "you" {
  return authorId === userId ? "me" : "you";
}

function nicknameFor(
  authorId: string,
  ctx: MembershipCtx,
): string {
  if (authorId === ctx.user.id) return ctx.membership.nickname;
  return partnerOf(ctx)?.nickname ?? "你";
}

function toEntryDTO(
  row: {
    id: string;
    day: string;
    title: string | null;
    body: string;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
    images: { id: string; url: string; sortOrder: number }[];
  },
  ctx: MembershipCtx,
): EntryDTO {
  return {
    id: row.id,
    day: row.day,
    title: row.title,
    body: row.body,
    authorId: row.authorId,
    authorSide: sideOf(row.authorId, ctx.user.id),
    authorNickname: nicknameFor(row.authorId, ctx),
    images: row.images
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({
        id: img.id,
        url: img.url,
        sortOrder: img.sortOrder,
      })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function persistableUrls(urls: string[] | undefined): string[] {
  if (!urls?.length) return [];
  return urls
    .filter(
      (u) =>
        u &&
        (u.startsWith("http://") ||
          u.startsWith("https://") ||
          u.startsWith("/api/files/")),
    )
    .slice(0, IMAGE_MAX);
}

const entrySchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式无效"),
  title: z
    .string()
    .trim()
    .max(TITLE_MAX, `标题最多 ${TITLE_MAX} 字`)
    .optional()
    .nullable(),
  body: z
    .string()
    .trim()
    .min(1, "请写一点正文")
    .max(BODY_MAX, `正文最多 ${BODY_MAX} 字`),
  imageUrls: z.array(z.string()).max(IMAGE_MAX).optional().default([]),
});

export type EntryActionResult = {
  ok: boolean;
  error?: string;
  entry?: EntryDTO;
};

export async function loadTimeline(opts?: {
  filter?: TimelineFilter;
  month?: string; // YYYY-MM
}): Promise<{
  items: TimelineItem[];
  stats: TimelineStats;
  partnerNickname: string;
  myNickname: string;
  currentMonth: string;
}> {
  const ctx = await requirePaired();
  const filter = opts?.filter ?? "all";
  const currentMonth = shanghaiMonth();
  const month = opts?.month && /^\d{4}-\d{2}$/.test(opts.month)
    ? opts.month
    : currentMonth;
  const spaceId = ctx.membership.spaceId;
  const partner = partnerOf(ctx);

  const [allEntries, allCheckIns] = await Promise.all([
    prisma.entry.findMany({
      where: { spaceId },
      include: { images: true },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
    }),
    prisma.checkIn.findMany({
      where: { spaceId },
      orderBy: [{ day: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  const stats: TimelineStats = {
    total: allEntries.length,
    mine: allEntries.filter((e) => e.authorId === ctx.user.id).length,
    yours: allEntries.filter((e) => e.authorId !== ctx.user.id).length,
    month: allEntries.filter((e) => e.day.startsWith(currentMonth)).length,
  };

  let entries = allEntries;
  let checkIns = allCheckIns;

  if (filter === "mine") {
    entries = entries.filter((e) => e.authorId === ctx.user.id);
    checkIns = checkIns.filter((c) => c.authorId === ctx.user.id);
  } else if (filter === "yours") {
    entries = entries.filter((e) => e.authorId !== ctx.user.id);
    checkIns = checkIns.filter((c) => c.authorId !== ctx.user.id);
  } else if (filter === "month") {
    entries = entries.filter((e) => e.day.startsWith(month));
    checkIns = checkIns.filter((c) => c.day.startsWith(month));
  }

  const entryItems: EntryListItem[] = entries.map((e) => ({
    kind: "entry" as const,
    id: e.id,
    day: e.day,
    title: e.title,
    bodyPreview: previewBody(e.body),
    authorSide: sideOf(e.authorId, ctx.user.id),
    authorNickname: nicknameFor(e.authorId, ctx),
    imageUrls: e.images
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => img.url)
      .slice(0, 3),
    createdAt: e.createdAt.toISOString(),
  }));

  const byDay = new Map<
    string,
    { mine?: (typeof checkIns)[number]; yours?: (typeof checkIns)[number] }
  >();
  for (const c of checkIns) {
    const bucket = byDay.get(c.day) ?? {};
    if (c.authorId === ctx.user.id) bucket.mine = c;
    else bucket.yours = c;
    byDay.set(c.day, bucket);
  }

  const checkInItems: CheckInSnapshotItem[] = [...byDay.entries()].map(
    ([day, pair]) => ({
      kind: "checkin" as const,
      id: `checkin-${day}`,
      day,
      mineLine: pair.mine?.line ?? null,
      yoursLine: pair.yours?.line ?? null,
      mineMood: pair.mine?.mood ?? null,
      yoursMood: pair.yours?.mood ?? null,
    }),
  );

  const items: TimelineItem[] = [...entryItems, ...checkInItems].sort((a, b) => {
    if (a.day !== b.day) return b.day.localeCompare(a.day);
    // 同日：日记在前，同步细条在后
    if (a.kind !== b.kind) return a.kind === "entry" ? -1 : 1;
    if (a.kind === "entry" && b.kind === "entry") {
      return b.createdAt.localeCompare(a.createdAt);
    }
    return 0;
  });

  return {
    items,
    stats,
    partnerNickname: partner?.nickname ?? "你",
    myNickname: ctx.membership.nickname,
    currentMonth,
  };
}

export async function getEntryById(id: string): Promise<EntryDTO | null> {
  const ctx = await requirePaired();
  const row = await prisma.entry.findFirst({
    where: { id, spaceId: ctx.membership.spaceId },
    include: { images: true },
  });
  if (!row) return null;
  return toEntryDTO(row, ctx);
}

export async function countEntriesForDay(day?: string) {
  const ctx = await requirePaired();
  const target = day ?? shanghaiDay();
  const count = await prisma.entry.count({
    where: { spaceId: ctx.membership.spaceId, day: target },
  });
  return { day: target, count };
}

export async function createEntryAction(input: {
  day: string;
  title?: string | null;
  body: string;
  imageUrls?: string[];
}): Promise<EntryActionResult> {
  const ctx = await requirePaired();
  const parsed = entrySchema.safeParse({
    ...input,
    imageUrls: persistableUrls(input.imageUrls),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "参数无效",
    };
  }

  const title = parsed.data.title?.trim() || null;
  const urls = parsed.data.imageUrls;

  const row = await prisma.entry.create({
    data: {
      spaceId: ctx.membership.spaceId,
      authorId: ctx.user.id,
      day: parsed.data.day,
      title,
      body: parsed.data.body,
      images: urls.length
        ? {
            create: urls.map((url, i) => ({
              url,
              sortOrder: i,
            })),
          }
        : undefined,
    },
    include: { images: true },
  });

  revalidatePath("/journal");
  revalidatePath("/today");
  return { ok: true, entry: toEntryDTO(row, ctx) };
}

export async function updateEntryAction(input: {
  id: string;
  day: string;
  title?: string | null;
  body: string;
  imageUrls?: string[];
}): Promise<EntryActionResult> {
  const ctx = await requirePaired();
  const existing = await prisma.entry.findFirst({
    where: { id: input.id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "日记不存在" };
  if (existing.authorId !== ctx.user.id) {
    return { ok: false, error: "只能编辑自己的日记" };
  }

  const parsed = entrySchema.safeParse({
    day: input.day,
    title: input.title,
    body: input.body,
    imageUrls: persistableUrls(input.imageUrls),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "参数无效",
    };
  }

  const title = parsed.data.title?.trim() || null;
  const urls = parsed.data.imageUrls;

  const row = await prisma.$transaction(async (tx) => {
    await tx.entryImage.deleteMany({ where: { entryId: existing.id } });
    return tx.entry.update({
      where: { id: existing.id },
      data: {
        day: parsed.data.day,
        title,
        body: parsed.data.body,
        images: urls.length
          ? {
              create: urls.map((url, i) => ({
                url,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: { images: true },
    });
  });

  revalidatePath("/journal");
  revalidatePath(`/journal/${existing.id}`);
  revalidatePath("/today");
  return { ok: true, entry: toEntryDTO(row, ctx) };
}

export async function deleteEntryAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const existing = await prisma.entry.findFirst({
    where: { id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "日记不存在" };
  if (existing.authorId !== ctx.user.id) {
    return { ok: false, error: "只能删除自己的日记" };
  }

  await prisma.entry.delete({ where: { id } });
  revalidatePath("/journal");
  revalidatePath("/today");
  return { ok: true };
}
