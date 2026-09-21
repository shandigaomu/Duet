import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) return null;
  return session.user;
}

/** 已配对：空间内已有 2 名成员 */
export async function getPairingState(userId: string) {
  const membership = await prisma.spaceMember.findUnique({
    where: { userId },
    include: {
      space: {
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!membership) {
    return { status: "none" as const, membership: null };
  }

  const count = membership.space.members.length;
  if (count < 2) {
    return { status: "waiting" as const, membership };
  }

  return { status: "paired" as const, membership };
}
