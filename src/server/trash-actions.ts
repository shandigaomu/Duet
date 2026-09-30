"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { previewBody } from "@/lib/journal";

/** P2-N5 回收站：Entry/Note 软删除（deletedAt）后的恢复与彻底删除 */
const TRASH_TTL_DAYS = 30;

export type TrashItem = {
  kind: "entry" | "note";
  id: string;
  title: string | null;
  preview: string;
  deletedAt: string;
  day: string | null;
};

/** 我删除的日记 + 悄悄话（仅自己的） */
export async function loadTrash(): Promise<{
  items: TrashItem[];
  cleaned: boolean;
}> {
  const ctx = await requirePaired();
  const spaceId = ctx.membership.spaceId;
  const userId = ctx.user.id;

  const cleaned = await cleanupExpired(spaceId);

  const [entries, notes] = await Promise.all([
    prisma.entry.findMany({
      where: { spaceId, authorId: userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: 100,
    }),
    prisma.note.findMany({
      where: { spaceId, authorId: userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: 100,
    }),
  ]);

  const items: TrashItem[] = [
    ...entries.map((e) => ({
      kind: "entry" as const,
      id: e.id,
      title: e.title,
      preview: previewBody(e.body, 60),
      deletedAt: (e.deletedAt as Date).toISOString(),
      day: e.day,
    })),
    ...notes.map((n) => ({
      kind: "note" as const,
      id: n.id,
      title: null,
      preview: previewBody(n.body, 60),
      deletedAt: (n.deletedAt as Date).toISOString(),
      day: null,
    })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  return { items, cleaned };
}

/** 每日首次触发清理：物理删 30 天前的软删项（免 cron） */
async function cleanupExpired(spaceId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 86_400_000);

  const expiredEntries = await prisma.entry.findMany({
    where: { spaceId, deletedAt: { not: null, lt: cutoff } },
    select: { id: true },
    take: 50,
  });
  const expiredNotes = await prisma.note.findMany({
    where: { spaceId, deletedAt: { not: null, lt: cutoff } },
    select: { id: true },
    take: 50,
  });

  if (expiredEntries.length === 0 && expiredNotes.length === 0) {
    return false;
  }

  await prisma.$transaction([
    // 图片行随 entry 级联删除；COS 侧对象保留（不可恢复成本高，V1 不做物理清桶）
    prisma.entry.deleteMany({
      where: { id: { in: expiredEntries.map((e) => e.id) } },
    }),
    prisma.note.deleteMany({
      where: { id: { in: expiredNotes.map((n) => n.id) } },
    }),
  ]);
  return true;
}

export async function restoreTrashItemAction(
  kind: "entry" | "note",
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const spaceId = ctx.membership.spaceId;
  const userId = ctx.user.id;

  if (kind === "entry") {
    const row = await prisma.entry.findFirst({
      where: { id, spaceId, authorId: userId, deletedAt: { not: null } },
    });
    if (!row) return { ok: false, error: "日记不在回收站" };
    await prisma.entry.update({ where: { id }, data: { deletedAt: null } });
  } else {
    const row = await prisma.note.findFirst({
      where: { id, spaceId, authorId: userId, deletedAt: { not: null } },
    });
    if (!row) return { ok: false, error: "悄悄话不在回收站" };
    // 回复的父级被彻底删除时父链已断，恢复本身无需修复
    await prisma.note.update({ where: { id }, data: { deletedAt: null } });
  }

  revalidatePath("/me/trash");
  revalidatePath("/journal");
  revalidatePath("/us/notes");
  return { ok: true };
}

export async function purgeTrashItemAction(
  kind: "entry" | "note",
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const spaceId = ctx.membership.spaceId;
  const userId = ctx.user.id;

  if (kind === "entry") {
    const row = await prisma.entry.findFirst({
      where: { id, spaceId, authorId: userId, deletedAt: { not: null } },
    });
    if (!row) return { ok: false, error: "日记不在回收站" };
    await prisma.entry.delete({ where: { id } });
  } else {
    const row = await prisma.note.findFirst({
      where: { id, spaceId, authorId: userId, deletedAt: { not: null } },
    });
    if (!row) return { ok: false, error: "悄悄话不在回收站" };
    await prisma.note.delete({ where: { id } });
  }

  revalidatePath("/me/trash");
  return { ok: true };
}
