"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import {
  categoryLabel,
  listItemSchema,
  type ListCategory,
  type ListItemDTO,
} from "@/lib/list";
import { shanghaiDay } from "@/lib/space";

type MembershipCtx = Awaited<ReturnType<typeof requirePaired>>;

function partnerOf(ctx: MembershipCtx) {
  return ctx.membership.space.members.find((m) => m.userId !== ctx.user.id);
}

function toDTO(
  row: {
    id: string;
    category: string;
    title: string;
    status: string;
    completedAt: Date | null;
    authorId: string;
    createdAt: Date;
  },
  ctx: MembershipCtx,
): ListItemDTO {
  const partner = partnerOf(ctx);
  return {
    id: row.id,
    category: row.category as ListCategory,
    title: row.title,
    status: row.status === "done" ? "done" : "open",
    completedAt: row.completedAt?.toISOString() ?? null,
    authorId: row.authorId,
    authorSide: row.authorId === ctx.user.id ? "me" : "you",
    authorNickname:
      row.authorId === ctx.user.id
        ? ctx.membership.nickname
        : (partner?.nickname ?? "你"),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function loadListItems(opts?: {
  category?: ListCategory | "all";
}): Promise<{
  items: ListItemDTO[];
  openCount: number;
  partnerNickname: string;
}> {
  const ctx = await requirePaired();
  const category = opts?.category ?? "all";
  const rows = await prisma.listItem.findMany({
    where: {
      spaceId: ctx.membership.spaceId,
      ...(category !== "all" ? { category } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const items = rows.map((r) => toDTO(r, ctx));
  return {
    items,
    openCount: items.filter((i) => i.status === "open").length,
    partnerNickname: partnerOf(ctx)?.nickname ?? "你",
  };
}

export async function loadUsOverview(): Promise<{
  openListCount: number;
  photoCount: number;
  noteCount: number;
}> {
  const ctx = await requirePaired();
  const spaceId = ctx.membership.spaceId;
  const userId = ctx.user.id;
  const [openListCount, photoCount, noteCount] = await Promise.all([
    prisma.listItem.count({ where: { spaceId, status: "open" } }),
    prisma.entryImage.count({
      where: {
        entry: {
          spaceId,
          OR: [{ visibility: "shared" }, { authorId: userId }],
        },
      },
    }),
    prisma.note.count({
      where: { spaceId, parentId: null },
    }),
  ]);
  return { openListCount, photoCount, noteCount };
}

export async function createListItemAction(input: {
  category: ListCategory;
  title: string;
}): Promise<{ ok: boolean; error?: string; item?: ListItemDTO }> {
  const ctx = await requirePaired();
  const parsed = listItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }
  const row = await prisma.listItem.create({
    data: {
      spaceId: ctx.membership.spaceId,
      authorId: ctx.user.id,
      category: parsed.data.category,
      title: parsed.data.title,
    },
  });
  revalidatePath("/us");
  revalidatePath("/us/lists");
  return { ok: true, item: toDTO(row, ctx) };
}

export async function completeListItemAction(input: {
  id: string;
  archiveToTimeline?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const existing = await prisma.listItem.findFirst({
    where: { id: input.id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "条目不存在" };
  if (existing.status === "done") return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.listItem.update({
      where: { id: existing.id },
      data: { status: "done", completedAt: new Date() },
    });
    if (input.archiveToTimeline) {
      await tx.entry.create({
        data: {
          spaceId: ctx.membership.spaceId,
          authorId: ctx.user.id,
          day: shanghaiDay(),
          title: `清单 · ${categoryLabel(existing.category)}`,
          body: `完成了「${existing.title}」`,
          visibility: "shared",
        },
      });
    }
  });

  revalidatePath("/us");
  revalidatePath("/us/lists");
  revalidatePath("/journal");
  revalidatePath("/today");
  return { ok: true };
}

export async function reopenListItemAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const existing = await prisma.listItem.findFirst({
    where: { id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "条目不存在" };
  await prisma.listItem.update({
    where: { id },
    data: { status: "open", completedAt: null },
  });
  revalidatePath("/us");
  revalidatePath("/us/lists");
  return { ok: true };
}

export async function deleteListItemAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const existing = await prisma.listItem.findFirst({
    where: { id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "条目不存在" };
  await prisma.listItem.delete({ where: { id } });
  revalidatePath("/us");
  revalidatePath("/us/lists");
  return { ok: true };
}
