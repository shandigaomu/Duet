"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import {
  BODY_MAX,
  IMAGE_MAX,
  REACTION_BODY_MAX,
  REACTION_EMOJIS,
  TITLE_MAX,
  previewBody,
  shanghaiMonth,
  shanghaiWeekRange,
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
    visibility?: string;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
    images: { id: string; url: string; sortOrder: number }[];
    reads?: { readerId: string; readAt: Date }[];
    reactions?: { authorId: string; emoji: string; body: string | null }[];
  },
  ctx: MembershipCtx,
): EntryDTO {
  const partner = partnerOf(ctx);
  const partnerRead = partner
    ? row.reads?.find((r) => r.readerId === partner.userId)
    : undefined;
  const mineReaction = row.reactions?.find((r) => r.authorId === ctx.user.id);
  const partnerReaction = partner
    ? row.reactions?.find((r) => r.authorId === partner.userId)
    : undefined;
  return {
    id: row.id,
    day: row.day,
    title: row.title,
    body: row.body,
    visibility: row.visibility === "private" ? "private" : "shared",
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
    partnerReadAt: partnerRead?.readAt.toISOString() ?? null,
    myReaction: mineReaction
      ? { emoji: mineReaction.emoji, body: mineReaction.body }
      : null,
    partnerReaction: partnerReaction
      ? { emoji: partnerReaction.emoji, body: partnerReaction.body }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function entryVisibleWhere(userId: string) {
  return {
    OR: [{ visibility: "shared" }, { authorId: userId }],
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
  visibility: z.enum(["shared", "private"]).optional().default("shared"),
});

export type EntryActionResult = {
  ok: boolean;
  error?: string;
  entry?: EntryDTO;
};

/** 时间线每页条数（日粒度对齐） */
const TIMELINE_PAGE = 20;
/** 每侧预取上限，确保能凑满一页并探测是否还有更多 */
const TIMELINE_FETCH = 40;

export async function loadTimeline(opts?: {
  filter?: TimelineFilter;
  month?: string; // YYYY-MM
  q?: string;
  /** 日粒度游标（YYYY-MM-DD）：只返回严格早于该日的条目；不传则取第一页 */
  cursor?: string;
}): Promise<{
  items: TimelineItem[];
  nextCursor: string | null;
  stats: TimelineStats;
  partnerNickname: string;
  myNickname: string;
  currentMonth: string;
  q: string;
}> {
  const ctx = await requirePaired();
  const filter = opts?.filter ?? "all";
  const q = (opts?.q ?? "").trim().slice(0, 80);
  const cursor =
    opts?.cursor && /^\d{4}-\d{2}-\d{2}$/.test(opts.cursor)
      ? opts.cursor
      : null;
  const currentMonth = shanghaiMonth();
  const month = opts?.month && /^\d{4}-\d{2}$/.test(opts.month)
    ? opts.month
    : currentMonth;
  const spaceId = ctx.membership.spaceId;
  const partner = partnerOf(ctx);

  // 筛选条件下推到查询（分页后不能再全量内存过滤）
  const filterDay: Record<string, unknown> | null =
    filter === "week"
      ? (() => {
          const { start, end } = shanghaiWeekRange();
          return { gte: start, lte: end };
        })()
      : filter === "thisMonth"
        ? { startsWith: currentMonth }
        : filter === "month"
          ? { startsWith: month }
          : null;
  const filterAuthor: string | { not: string } | null =
    filter === "mine"
      ? ctx.user.id
      : filter === "yours"
        ? { not: ctx.user.id }
        : null;

  const entryWhere = {
    spaceId,
    AND: [
      entryVisibleWhere(ctx.user.id),
      ...(q
        ? [
            {
              OR: [
                { title: { contains: q } },
                { body: { contains: q } },
              ],
            },
          ]
        : []),
      ...(filterAuthor ? [{ authorId: filterAuthor }] : []),
      ...(filterDay ? [{ day: filterDay }] : []),
      ...(cursor ? [{ day: { lt: cursor } }] : []),
    ],
  };
  const checkInWhere = {
    spaceId,
    ...(filterAuthor ? { authorId: filterAuthor } : {}),
    ...(filterDay ? { day: filterDay } : {}),
    ...(cursor ? { day: { lt: cursor } } : {}),
  };

  const [entryRows, checkInRows, total, mine, yours, monthCount] =
    await Promise.all([
      prisma.entry.findMany({
        where: entryWhere,
        include: { images: true, reads: true, reactions: true },
        orderBy: [{ day: "desc" }, { createdAt: "desc" }],
        take: TIMELINE_FETCH,
      }),
      q
        ? Promise.resolve([])
        : prisma.checkIn.findMany({
            where: checkInWhere,
            orderBy: [{ day: "desc" }, { updatedAt: "desc" }],
            take: TIMELINE_FETCH,
          }),
      prisma.entry.count({
        where: { spaceId, AND: [entryVisibleWhere(ctx.user.id)] },
      }),
      prisma.entry.count({
        where: {
          spaceId,
          AND: [entryVisibleWhere(ctx.user.id), { authorId: ctx.user.id }],
        },
      }),
      prisma.entry.count({
        where: {
          spaceId,
          AND: [
            entryVisibleWhere(ctx.user.id),
            { authorId: { not: ctx.user.id } },
          ],
        },
      }),
      prisma.entry.count({
        where: {
          spaceId,
          AND: [
            entryVisibleWhere(ctx.user.id),
            { day: { startsWith: currentMonth } },
          ],
        },
      }),
    ]);

  const stats: TimelineStats = { total, mine, yours, month: monthCount };

  const entries = entryRows;
  const checkIns = checkInRows;

  const partnerId = partner?.userId;
  const entryItems: EntryListItem[] = entries.map((e) => ({
    kind: "entry" as const,
    id: e.id,
    day: e.day,
    title: e.title,
    bodyPreview: previewBody(e.body),
    visibility: e.visibility === "private" ? "private" : "shared",
    authorSide: sideOf(e.authorId, ctx.user.id),
    authorNickname: nicknameFor(e.authorId, ctx),
    imageUrls: e.images
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => img.url)
      .slice(0, 3),
    partnerReadAt:
      e.authorId === ctx.user.id && partnerId
        ? (e.reads.find((r) => r.readerId === partnerId)?.readAt.toISOString() ??
          null)
        : null,
    myReactionAt:
      e.authorId === ctx.user.id
        ? (e.reactions.find((r) => r.authorId === ctx.user.id)?.createdAt.toISOString() ??
          null)
        : null,
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

  const sorted: TimelineItem[] = [...entryItems, ...checkInItems].sort(
    (a, b) => {
      if (a.day !== b.day) return b.day.localeCompare(a.day);
      // 同日：日记在前，同步细条在后
      if (a.kind !== b.kind) return a.kind === "entry" ? -1 : 1;
      if (a.kind === "entry" && b.kind === "entry") {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return 0;
    },
  );

  // 日粒度对齐截断：页面尾部完整包含该日全部条目
  let end = Math.min(TIMELINE_PAGE, sorted.length);
  if (end < sorted.length) {
    const boundaryDay = sorted[end - 1]!.day;
    while (end < sorted.length && sorted[end]!.day === boundaryDay) end++;
  }
  const pageItems = sorted.slice(0, end);
  const fetchCapped =
    entryRows.length >= TIMELINE_FETCH || checkInRows.length >= TIMELINE_FETCH;
  const nextCursor =
    end < sorted.length || fetchCapped
      ? (pageItems[pageItems.length - 1]?.day ?? null)
      : null;

  return {
    items: pageItems,
    nextCursor,
    stats,
    partnerNickname: partner?.nickname ?? "你",
    myNickname: ctx.membership.nickname,
    currentMonth,
    q,
  };
}

export async function getEntryById(id: string): Promise<EntryDTO | null> {
  const ctx = await requirePaired();
  const row = await prisma.entry.findFirst({
    where: {
      id,
      spaceId: ctx.membership.spaceId,
      ...entryVisibleWhere(ctx.user.id),
    },
    include: { images: true, reads: true, reactions: true },
  });
  if (!row) return null;
  return toEntryDTO(row, ctx);
}

export async function countEntriesForDay(day?: string) {
  const ctx = await requirePaired();
  const target = day ?? shanghaiDay();
  const count = await prisma.entry.count({
    where: {
      spaceId: ctx.membership.spaceId,
      day: target,
      ...entryVisibleWhere(ctx.user.id),
    },
  });
  return { day: target, count };
}

export async function createEntryAction(input: {
  day: string;
  title?: string | null;
  body: string;
  imageUrls?: string[];
  visibility?: "shared" | "private";
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
      visibility: parsed.data.visibility,
      images: urls.length
        ? {
            create: urls.map((url, i) => ({
              url,
              sortOrder: i,
            })),
          }
        : undefined,
    },
    include: { images: true, reads: true },
  });

  revalidatePath("/journal");
  revalidatePath("/today");
  revalidatePath("/us");
  revalidatePath("/us/album");
  return { ok: true, entry: toEntryDTO(row, ctx) };
}

export async function updateEntryAction(input: {
  id: string;
  day: string;
  title?: string | null;
  body: string;
  imageUrls?: string[];
  visibility?: "shared" | "private";
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
    visibility: input.visibility,
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
        visibility: parsed.data.visibility,
        images: urls.length
          ? {
              create: urls.map((url, i) => ({
                url,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: { images: true, reads: true },
    });
  });

  revalidatePath("/journal");
  revalidatePath(`/journal/${existing.id}`);
  revalidatePath("/today");
  revalidatePath("/us/album");
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

/** 对方打开日记详情时标记已读（自己打开自己的不写） */
export async function markEntryReadAction(
  entryId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const entry = await prisma.entry.findFirst({
    where: { id: entryId, spaceId: ctx.membership.spaceId },
  });
  if (!entry) return { ok: false, error: "日记不存在" };
  if (entry.authorId === ctx.user.id) return { ok: true };

  await prisma.entryRead.upsert({
    where: {
      entryId_readerId: {
        entryId: entry.id,
        readerId: ctx.user.id,
      },
    },
    create: {
      entryId: entry.id,
      readerId: ctx.user.id,
    },
    update: {
      readAt: new Date(),
    },
  });

  revalidatePath("/journal");
  revalidatePath(`/journal/${entry.id}`);
  return { ok: true };
}

const reactionSchema = z.object({
  entryId: z.string().min(1),
  emoji: z.string().trim().min(1).max(8),
  body: z
    .string()
    .trim()
    .max(REACTION_BODY_MAX, `最多 ${REACTION_BODY_MAX} 字`)
    .optional()
    .default(""),
});

/** P0-1：回应/修改回应（一条日记限一条/人） */
export async function upsertEntryReactionAction(input: {
  entryId: string;
  emoji: string;
  body?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const parsed = reactionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }
  if (!REACTION_EMOJIS.includes(parsed.data.emoji as (typeof REACTION_EMOJIS)[number])) {
    return { ok: false, error: "无效的表情" };
  }

  const entry = await prisma.entry.findFirst({
    where: {
      id: parsed.data.entryId,
      spaceId: ctx.membership.spaceId,
    },
  });
  if (!entry) return { ok: false, error: "日记不存在" };
  if (entry.authorId === ctx.user.id) {
    return { ok: false, error: "不能回应自己的日记" };
  }

  await prisma.entryReaction.upsert({
    where: {
      entryId_authorId: {
        entryId: entry.id,
        authorId: ctx.user.id,
      },
    },
    create: {
      entryId: entry.id,
      authorId: ctx.user.id,
      emoji: parsed.data.emoji,
      body: parsed.data.body || null,
    },
    update: {
      emoji: parsed.data.emoji,
      body: parsed.data.body || null,
    },
  });

  revalidatePath("/journal");
  revalidatePath(`/journal/${entry.id}`);
  return { ok: true };
}

/** P0-1：撤回回应 */
export async function deleteEntryReactionAction(
  entryId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  await prisma.entryReaction.deleteMany({
    where: { entryId, authorId: ctx.user.id },
  });
  revalidatePath("/journal");
  revalidatePath(`/journal/${entryId}`);
  return { ok: true };
}
