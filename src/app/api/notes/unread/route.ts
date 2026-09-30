import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPairingState, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** P2-N7：对方在 since 之后的新悄悄话数（未读小点用） */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }
  const pairing = await getPairingState(user.id);
  if (pairing.status !== "paired" || !pairing.membership) {
    return NextResponse.json({ count: 0 });
  }

  const sinceParam = new URL(request.url).searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;
  const partner = pairing.membership.space.members.find(
    (m) => m.userId !== user.id,
  );
  if (!partner) return NextResponse.json({ count: 0 });

  const count = await prisma.note.count({
    where: {
      spaceId: pairing.membership.spaceId,
      authorId: partner.userId,
      deletedAt: null,
      ...(since && !Number.isNaN(since.getTime())
        ? { createdAt: { gt: since } }
        : {}),
    },
  });

  return NextResponse.json({ count });
}
