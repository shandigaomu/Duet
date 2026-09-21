"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";

const schema = z.object({
  nickname: z.string().trim().min(1, "请填写昵称").max(40, "昵称过长"),
  avatarUrl: z.string().trim().max(512).nullable(),
});

export type UpdateProfileResult = {
  ok: boolean;
  error?: string;
  nickname?: string;
  avatarUrl?: string | null;
};

function sanitizeAvatarUrl(url: string | null | undefined) {
  if (url == null || url === "") return null;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("/api/files/")
  ) {
    return url;
  }
  return null;
}

export async function updateProfileAction(input: {
  nickname: string;
  avatarUrl: string | null;
}): Promise<UpdateProfileResult> {
  const { user, membership } = await requirePaired();

  const parsed = schema.safeParse({
    nickname: input.nickname,
    avatarUrl: sanitizeAvatarUrl(input.avatarUrl),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "参数无效",
    };
  }

  const nextAvatar = parsed.data.avatarUrl;

  await prisma.$transaction([
    prisma.spaceMember.update({
      where: { id: membership.id },
      data: {
        nickname: parsed.data.nickname,
        avatarUrl: nextAvatar,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.nickname,
        image: nextAvatar,
      },
    }),
  ]);

  revalidatePath("/me");
  revalidatePath("/today");
  revalidatePath("/journal");

  return {
    ok: true,
    nickname: parsed.data.nickname,
    avatarUrl: nextAvatar,
  };
}
