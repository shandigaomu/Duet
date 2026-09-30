"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { letterSchema, toLetterDTO, type LetterDTO } from "@/lib/letter";
import { shanghaiDay } from "@/lib/space";
import { pushLetterUnlocked, pushToPartner } from "@/server/push";

type MembershipCtx = Awaited<ReturnType<typeof requirePaired>>;

function partnerOf(ctx: MembershipCtx) {
  return ctx.membership.space.members.find((m) => m.userId !== ctx.user.id);
}

/** 解锁当天首次被看到时顺带通知对方（无 cron，靠访问触发，每进程每信一次） */
const unlockNotified = new Set<string>();

export async function loadLetters(): Promise<{
  today: string;
  letters: LetterDTO[];
  partnerNickname: string;
}> {
  const ctx = await requirePaired();
  const today = shanghaiDay();
  const rows = await prisma.letter.findMany({
    where: { spaceId: ctx.membership.spaceId },
    orderBy: [{ unlockDay: "asc" }, { createdAt: "desc" }],
  });
  const partner = partnerOf(ctx);
  const letters = rows.map((r) =>
    toLetterDTO(r, { viewerId: ctx.user.id, today }),
  );

  for (const letter of letters) {
    if (letter.state !== "unlocking") continue;
    if (unlockNotified.has(letter.id)) continue;
    unlockNotified.add(letter.id);
    pushToPartner(
      partner?.userId,
      ctx.user.id,
      pushLetterUnlocked(letter.title),
    );
  }

  return {
    today,
    letters,
    partnerNickname: partner?.nickname ?? "你",
  };
}

export async function createLetterAction(input: {
  title?: string | null;
  body: string;
  unlockDay: string;
  imageUrl?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const parsed = letterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }
  const today = shanghaiDay();
  if (parsed.data.unlockDay < today) {
    return { ok: false, error: "解锁日不能早于今天" };
  }

  await prisma.letter.create({
    data: {
      spaceId: ctx.membership.spaceId,
      authorId: ctx.user.id,
      title: parsed.data.title || null,
      body: parsed.data.body,
      imageUrl:
        parsed.data.imageUrl &&
        (parsed.data.imageUrl.startsWith("http") ||
          parsed.data.imageUrl.startsWith("/api/files/"))
          ? parsed.data.imageUrl
          : null,
      unlockDay: parsed.data.unlockDay,
    },
  });

  revalidatePath("/us/letters");
  return { ok: true };
}

export async function updateLetterAction(input: {
  id: string;
  title?: string | null;
  body: string;
  unlockDay: string;
  imageUrl?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const today = shanghaiDay();
  const existing = await prisma.letter.findFirst({
    where: { id: input.id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "信不存在" };
  if (existing.authorId !== ctx.user.id) {
    return { ok: false, error: "只能编辑自己的信" };
  }
  if (existing.unlockDay <= today) {
    return { ok: false, error: "已解锁的信不能再修改" };
  }

  const parsed = letterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }
  if (parsed.data.unlockDay < today) {
    return { ok: false, error: "解锁日不能早于今天" };
  }

  await prisma.letter.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title || null,
      body: parsed.data.body,
      unlockDay: parsed.data.unlockDay,
      imageUrl:
        parsed.data.imageUrl &&
        (parsed.data.imageUrl.startsWith("http") ||
          parsed.data.imageUrl.startsWith("/api/files/"))
          ? parsed.data.imageUrl
          : null,
    },
  });

  revalidatePath("/us/letters");
  return { ok: true };
}

export async function deleteLetterAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requirePaired();
  const today = shanghaiDay();
  const existing = await prisma.letter.findFirst({
    where: { id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "信不存在" };
  if (existing.authorId !== ctx.user.id) {
    return { ok: false, error: "只能删除自己的信" };
  }
  if (existing.unlockDay <= today) {
    return { ok: false, error: "已解锁的信不能删除" };
  }
  await prisma.letter.delete({ where: { id: existing.id } });
  revalidatePath("/us/letters");
  return { ok: true };
}
