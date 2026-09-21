"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateInviteCode } from "@/lib/space";

export type ActionResult = {
  ok: boolean;
  error?: string;
  inviteCode?: string;
};

async function requireSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) return null;
  return session.user;
}

export async function getMembershipForUser(userId: string) {
  return prisma.spaceMember.findUnique({
    where: { userId },
    include: {
      space: {
        include: {
          members: true,
        },
      },
    },
  });
}

const createSchema = z.object({
  nickname: z.string().trim().min(1, "请填写昵称").max(40, "昵称过长"),
});

export async function createSpaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return { ok: false, error: "请先登录" };

  const parsed = createSchema.safeParse({
    nickname: formData.get("nickname"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }

  const existing = await prisma.spaceMember.findUnique({
    where: { userId: user.id },
  });
  if (existing) {
    return { ok: false, error: "你已在一个空间中" };
  }

  let inviteCode = generateInviteCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.space.findUnique({ where: { inviteCode } });
    if (!clash) break;
    inviteCode = generateInviteCode();
  }

  await prisma.space.create({
    data: {
      inviteCode,
      members: {
        create: {
          userId: user.id,
          nickname: parsed.data.nickname,
          avatarUrl: user.image,
        },
      },
    },
  });

  return { ok: true, inviteCode };
}

const joinSchema = z.object({
  nickname: z.string().trim().min(1, "请填写昵称").max(40, "昵称过长"),
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "邀请码无效")
    .max(12, "邀请码无效"),
});

export async function joinSpaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return { ok: false, error: "请先登录" };

  const parsed = joinSchema.safeParse({
    nickname: formData.get("nickname"),
    inviteCode: formData.get("inviteCode"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }

  const existing = await prisma.spaceMember.findUnique({
    where: { userId: user.id },
  });
  if (existing) {
    return { ok: false, error: "你已在一个空间中" };
  }

  const space = await prisma.space.findUnique({
    where: { inviteCode: parsed.data.inviteCode },
    include: { members: true },
  });
  if (!space) {
    return { ok: false, error: "邀请码不存在" };
  }
  if (space.members.length >= 2) {
    return { ok: false, error: "该空间已满（仅两人）" };
  }

  await prisma.spaceMember.create({
    data: {
      spaceId: space.id,
      userId: user.id,
      nickname: parsed.data.nickname,
      avatarUrl: user.image,
    },
  });

  redirect("/today");
}

export async function unpairSpaceAction(): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return { ok: false, error: "请先登录" };

  const membership = await prisma.spaceMember.findUnique({
    where: { userId: user.id },
  });
  if (!membership) {
    return { ok: false, error: "你不在任何空间中" };
  }

  // 解除配对：删除整个空间（双方回到未配对）
  await prisma.space.delete({
    where: { id: membership.spaceId },
  });

  redirect("/create");
}

/** 创建方等待页轮询：对方加入后返回 ready */
export async function checkPairingReadyAction(): Promise<{ ready: boolean }> {
  const user = await requireSessionUser();
  if (!user) return { ready: false };

  const membership = await prisma.spaceMember.findUnique({
    where: { userId: user.id },
    include: {
      space: { include: { members: { select: { id: true } } } },
    },
  });
  if (!membership) return { ready: false };
  return { ready: membership.space.members.length >= 2 };
}
