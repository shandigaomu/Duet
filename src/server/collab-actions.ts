"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { shanghaiDay } from "@/lib/space";

/** P2-N8 合写日记：各写各段、互不可改对方文字；双方确认后 published */

type MembershipCtx = Awaited<ReturnType<typeof requirePaired>>;

function partnerOf(ctx: MembershipCtx) {
  return ctx.membership.space.members.find((m) => m.userId !== ctx.user.id);
}

const sectionSchema = z.object({
  entryId: z.string().min(1),
  body: z.string().trim().min(1, "写一段吧").max(20_000),
  imageUrls: z
    .array(z.string())
    .max(9)
    .optional()
    .default([]),
});

const PENDING_TTL_DAYS = 7;

/** 邀请 TA 合写某天的日记（Entry.collabStatus: none → pending） */
export async function inviteCollabAction(input: {
  day: string;
  title: string | null;
  body: string;
  imageUrls?: string[];
  visibility?: "shared" | "private";
}): Promise<{ ok: boolean; error?: string; entryId?: string }> {
  const ctx = await requirePaired();
  const partner = partnerOf(ctx);
  if (!partner) return { ok: false, error: "还未配对" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) {
    return { ok: false, error: "日期格式无效" };
  }

  const row = await prisma.entry.create({
    data: {
      spaceId: ctx.membership.spaceId,
      authorId: ctx.user.id,
      day: input.day,
      title: input.title,
      body: input.body,
      visibility: "shared",
      collabStatus: "pending",
      images: {
        create: (input.imageUrls ?? []).map((url, i) => ({
          url,
          sortOrder: i,
        })),
      },
    },
    include: { images: true, reads: true },
  });

  revalidatePath("/today");
  revalidatePath("/journal");
  return { ok: true, entryId: row.id };
}

/** 对方在自己的段落区提交/更新段落 */
export async function submitCollabSectionAction(input: {
  entryId: string;
  body: string;
  imageUrls?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }

  const entry = await prisma.entry.findFirst({
    where: {
      id: parsed.data.entryId,
      spaceId: ctx.membership.spaceId,
      collabStatus: "pending",
    },
  });
  if (!entry) return { ok: false, error: "合写邀请不存在或已结束" };
  if (entry.authorId === ctx.user.id) {
    return { ok: false, error: "邀请人无需提交段落" };
  }

  const urls = parsed.data.imageUrls.filter(
    (u) =>
      u.startsWith("http://") ||
      u.startsWith("https://") ||
      u.startsWith("/api/files/"),
  );

  await prisma.entrySection.upsert({
    where: {
      entryId_authorId: {
        entryId: entry.id,
        authorId: ctx.user.id,
      },
    },
    create: {
      entryId: entry.id,
      authorId: ctx.user.id,
      body: parsed.data.body,
      images: urls.length ? urls : undefined,
    },
    update: {
      body: parsed.data.body,
      images: urls.length ? urls : undefined,
    },
  });

  revalidatePath("/today");
  revalidatePath(`/journal/${entry.id}`);
  return { ok: true };
}

/** 双方各自确认完成；两人都确认 → published */
export async function confirmCollabAction(input: {
  entryId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const entry = await prisma.entry.findFirst({
    where: {
      id: input.entryId,
      spaceId: ctx.membership.spaceId,
      collabStatus: "pending",
    },
  });
  if (!entry) return { ok: false, error: "合写邀请不存在或已结束" };

  await prisma.entrySection.upsert({
    where: {
      entryId_authorId: {
        entryId: entry.id,
        authorId: ctx.user.id,
      },
    },
    create: {
      entryId: entry.id,
      authorId: ctx.user.id,
      body: entry.body,
    },
    update: { confirmedAt: new Date() },
  });

  // 重新取双方 section：双方都确认 → published
  const sections = await prisma.entrySection.findMany({
    where: { entryId: entry.id },
  });
  const partner = partnerOf(ctx);
  const allConfirmed =
    sections.length >= 2 &&
    sections.every((s) => s.confirmedAt !== null) &&
    Boolean(partner);

  if (allConfirmed) {
    await prisma.entry.update({
      where: { id: entry.id },
      data: { collabStatus: "published" },
    });
    revalidatePath("/journal");
  }

  revalidatePath("/today");
  revalidatePath(`/journal/${entry.id}`);
  return { ok: true };
}

/** 撤回邀请（仅邀请人，pending 有效期内）→ 流回普通日记 */
export async function revokeCollabAction(input: {
  entryId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const entry = await prisma.entry.findFirst({
    where: {
      id: input.entryId,
      spaceId: ctx.membership.spaceId,
      collabStatus: "pending",
      authorId: ctx.user.id,
    },
  });
  if (!entry) return { ok: false, error: "合写邀请不存在" };

  await prisma.$transaction([
    prisma.entrySection.deleteMany({ where: { entryId: entry.id } }),
    prisma.entry.update({
      where: { id: entry.id },
      data: { collabStatus: "none" },
    }),
  ]);

  revalidatePath("/today");
  revalidatePath("/journal");
  return { ok: true };
}

/** pending 超 7 天自动流回普通日记（今日页加载时顺带处理，免 cron） */
export async function expireStaleCollabs(spaceId: string): Promise<void> {
  const cutoff = new Date(Date.now() - PENDING_TTL_DAYS * 86_400_000);
  const stale = await prisma.entry.findMany({
    where: {
      spaceId,
      collabStatus: "pending",
      createdAt: { lt: cutoff },
    },
    select: { id: true },
    take: 20,
  });
  if (stale.length === 0) return;
  await prisma.$transaction([
    prisma.entrySection.deleteMany({
      where: { entryId: { in: stale.map((s) => s.id) } },
    }),
    prisma.entry.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { collabStatus: "none" },
    }),
  ]);
}

/** 今日页邀请卡：对方 pending 的、今天或更早的合写日记 */
export async function loadCollabInvite(): Promise<{
  entryId: string;
  day: string;
  title: string | null;
  authorNickname: string;
  mySectionSubmitted: boolean;
  iConfirmed: boolean;
  partnerConfirmed: boolean;
} | null> {
  const ctx = await requirePaired();
  const partner = partnerOf(ctx);
  if (!partner) return null;
  await expireStaleCollabs(ctx.membership.spaceId);

  const row = await prisma.entry.findFirst({
    where: {
      spaceId: ctx.membership.spaceId,
      collabStatus: "pending",
      authorId: partner.userId,
      day: { lte: shanghaiDay() },
    },
    include: { sections: true },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;

  const mine = row.sections.find((s) => s.authorId === ctx.user.id) ?? null;
  const theirs =
    row.sections.find((s) => s.authorId === partner.userId) ?? null;
  return {
    entryId: row.id,
    day: row.day,
    title: row.title,
    authorNickname: partner.nickname,
    mySectionSubmitted: Boolean(mine && !mine.confirmedAt),
    iConfirmed: Boolean(mine?.confirmedAt),
    partnerConfirmed: Boolean(theirs?.confirmedAt),
  };
}
