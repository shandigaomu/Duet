"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import {
  BURN_AFTER_READ_MS,
  noteSchema,
  type NoteDTO,
} from "@/lib/note";

type MembershipCtx = Awaited<ReturnType<typeof requirePaired>>;

function partnerOf(ctx: MembershipCtx) {
  return ctx.membership.space.members.find((m) => m.userId !== ctx.user.id);
}

function toDTO(
  row: {
    id: string;
    body: string;
    parentId: string | null;
    pinned: boolean;
    authorId: string;
    createdAt: Date;
    burn: boolean;
    readAt: Date | null;
    expiresAt: Date | null;
    replies?: {
      id: string;
      body: string;
      parentId: string | null;
      pinned: boolean;
      authorId: string;
      createdAt: Date;
      readAt: Date | null;
      expiresAt: Date | null;
      burn: boolean;
    }[];
  },
  ctx: MembershipCtx,
): NoteDTO {
  const partner = partnerOf(ctx);
  const nick = (authorId: string) =>
    authorId === ctx.user.id
      ? ctx.membership.nickname
      : (partner?.nickname ?? "你");
  return {
    id: row.id,
    body: row.body,
    parentId: row.parentId,
    pinned: row.pinned,
    authorId: row.authorId,
    authorSide: row.authorId === ctx.user.id ? "me" : "you",
    authorNickname: nick(row.authorId),
    createdAt: row.createdAt.toISOString(),
    burn: row.burn,
    readAt: row.readAt?.toISOString() ?? null,
    burnAt: row.expiresAt?.toISOString() ?? null,
    replies: (row.replies ?? [])
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((r) => ({
        id: r.id,
        body: r.body,
        parentId: r.parentId,
        pinned: r.pinned,
        authorId: r.authorId,
        authorSide: (r.authorId === ctx.user.id ? "me" : "you") as "me" | "you",
        authorNickname: nick(r.authorId),
        createdAt: r.createdAt.toISOString(),
        burn: r.burn,
        readAt: r.readAt?.toISOString() ?? null,
        burnAt: r.expiresAt?.toISOString() ?? null,
        replies: [],
      })),
  };
}

export async function loadNotes(): Promise<{
  pinned: NoteDTO | null;
  notes: NoteDTO[];
  partnerNickname: string;
}> {
  const ctx = await requirePaired();
  const spaceId = ctx.membership.spaceId;
  const now = new Date();

  // P3-T8：到点即焚（物理删除，不进回收站——趁每次打开顺带清理）
  await prisma.note.deleteMany({
    where: { spaceId, expiresAt: { lte: now } },
  });
  // P3-T8：阅后即焚计时锚点——打开页者 = 「读者」，只为非本人所发的焚毁信首读计时
  // （双方各自打开页面时各自触发；reader 读到的作者本人的信同样会被对方侧落表）
  await prisma.note.updateMany({
    where: {
      spaceId,
      burn: true,
      authorId: { not: ctx.user.id },
      readAt: null,
      deletedAt: null,
    },
    data: {
      readAt: now,
      expiresAt: new Date(now.getTime() + BURN_AFTER_READ_MS),
    },
  });

  const rows = await prisma.note.findMany({
    where: {
      spaceId,
      parentId: null,
      deletedAt: null,
      // 双保险：到点的行不渲染（清理失败也不漏）
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { replies: true },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  const notes = rows.map((r) => toDTO(r, ctx));
  return {
    pinned: notes.find((n) => n.pinned) ?? null,
    notes,
    partnerNickname: partnerOf(ctx)?.nickname ?? "你",
  };
}

export async function createNoteAction(input: {
  body: string;
  parentId?: string | null;
  burnAfterReading?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }
  if (parsed.data.parentId) {
    const parent = await prisma.note.findFirst({
      where: {
        id: parsed.data.parentId,
        spaceId: ctx.membership.spaceId,
        parentId: null,
      },
    });
    if (!parent) return { ok: false, error: "原留言不存在" };
  }

  // P3-T8：阅后即焚信不置顶、不进回收站
  await prisma.note.create({
    data: {
      spaceId: ctx.membership.spaceId,
      authorId: ctx.user.id,
      body: parsed.data.body,
      parentId: parsed.data.parentId ?? null,
      burn: parsed.data.burnAfterReading || false,
    },
  });

  revalidatePath("/us");
  revalidatePath("/us/notes");
  return { ok: true };
}

export async function pinNoteAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const existing = await prisma.note.findFirst({
    where: { id, spaceId: ctx.membership.spaceId, parentId: null },
  });
  if (!existing) return { ok: false, error: "留言不存在" };
  // P3-T8：置顶位与焚毁互斥（不留永久收入的会话也不做永久置顶）
  if (existing.burn && !existing.pinned) {
    return { ok: false, error: "阅后即焚的悄悄话不能置顶" };
  }

  if (existing.pinned) {
    await prisma.note.update({
      where: { id },
      data: { pinned: false },
    });
  } else {
    await prisma.$transaction([
      prisma.note.updateMany({
        where: { spaceId: ctx.membership.spaceId, pinned: true },
        data: { pinned: false },
      }),
      prisma.note.update({
        where: { id },
        data: { pinned: true },
      }),
    ]);
  }

  revalidatePath("/us");
  revalidatePath("/us/notes");
  return { ok: true };
}

export async function deleteNoteAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const existing = await prisma.note.findFirst({
    where: { id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "留言不存在" };
  if (existing.authorId !== ctx.user.id) {
    return { ok: false, error: "只能删除自己的留言" };
  }
  // P3-T8：阅后即焚不进回收站（烧掉就是烧掉），直接物理删；其余仍走两段式软删
  if (existing.burn) {
    await prisma.note.delete({ where: { id } });
    revalidatePath("/us");
    revalidatePath("/us/notes");
    return { ok: true };
  }
  // P2-N5：两段式删除——软删进回收站，30 天后物理清理
  await prisma.note.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/us");
  revalidatePath("/us/notes");
  revalidatePath("/me/trash");
  return { ok: true };
}
