"use server";

import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";

/** 相册每页张数 */
const ALBUM_PAGE = 60;

export type AlbumPhoto = {
  id: string;
  url: string;
  entryId: string;
  day: string;
  title: string | null;
  authorSide: "me" | "you";
  authorNickname: string;
  createdAt: string;
};

export async function loadAlbum(opts?: {
  source?: "all" | "mine" | "yours";
  /** 游标：上一页最后一张图的 id（Prisma 原生 cursor 分页） */
  cursor?: string;
  take?: number;
}): Promise<{
  photos: AlbumPhoto[];
  partnerNickname: string;
  nextCursor: string | null;
}> {
  const ctx = await requirePaired();
  const source = opts?.source ?? "all";
  const take = Math.min(Math.max(opts?.take ?? ALBUM_PAGE, 1), 120);
  const partner = ctx.membership.space.members.find(
    (m) => m.userId !== ctx.user.id,
  );
  const partnerNickname = partner?.nickname ?? "你";

  const rows = await prisma.entryImage.findMany({
    where: {
      entry: {
        spaceId: ctx.membership.spaceId,
        OR: [{ visibility: "shared" }, { authorId: ctx.user.id }],
        deletedAt: null,
        ...(source === "mine"
          ? { authorId: ctx.user.id }
          : source === "yours"
            ? { authorId: { not: ctx.user.id } }
            : {}),
      },
    },
    include: {
      entry: {
        select: {
          id: true,
          day: true,
          title: true,
          authorId: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ entry: { day: "desc" } }, { sortOrder: "asc" }],
    ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    // 多取 1 条探测是否还有下一页
    take: take + 1,
  });

  const hasMore = rows.length > take;
  const pageRows = rows.slice(0, take);
  const photos: AlbumPhoto[] = pageRows.map((r) => ({
    id: r.id,
    url: r.url,
    entryId: r.entry.id,
    day: r.entry.day,
    title: r.entry.title,
    authorSide: r.entry.authorId === ctx.user.id ? "me" : "you",
    authorNickname:
      r.entry.authorId === ctx.user.id
        ? ctx.membership.nickname
        : partnerNickname,
    createdAt: r.entry.createdAt.toISOString(),
  }));
  const nextCursor = hasMore
    ? (pageRows[pageRows.length - 1]?.id ?? null)
    : null;

  return { photos, partnerNickname, nextCursor };
}
