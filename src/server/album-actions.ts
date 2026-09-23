"use server";

import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";

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
}): Promise<{ photos: AlbumPhoto[]; partnerNickname: string }> {
  const ctx = await requirePaired();
  const source = opts?.source ?? "all";
  const partner = ctx.membership.space.members.find(
    (m) => m.userId !== ctx.user.id,
  );
  const partnerNickname = partner?.nickname ?? "你";

  const rows = await prisma.entryImage.findMany({
    where: {
      entry: {
        spaceId: ctx.membership.spaceId,
        OR: [{ visibility: "shared" }, { authorId: ctx.user.id }],
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
  });

  const photos: AlbumPhoto[] = rows.map((r) => ({
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

  return { photos, partnerNickname };
}
