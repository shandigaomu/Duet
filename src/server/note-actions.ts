"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { noteSchema, type NoteDTO } from "@/lib/note";

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
    replies?: {
      id: string;
      body: string;
      parentId: string | null;
      pinned: boolean;
      authorId: string;
      createdAt: Date;
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
  const rows = await prisma.note.findMany({
    where: { spaceId: ctx.membership.spaceId, parentId: null },
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
  await prisma.note.create({
    data: {
      spaceId: ctx.membership.spaceId,
      authorId: ctx.user.id,
      body: parsed.data.body,
      parentId: parsed.data.parentId ?? null,
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
  await prisma.note.delete({ where: { id } });
  revalidatePath("/us");
  revalidatePath("/us/notes");
  return { ok: true };
}
