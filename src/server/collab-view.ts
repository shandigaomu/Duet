import { prisma } from "@/lib/db";

/**
 * P2-N8：今日页合写卡数据。
 * - incoming：对方发起、需要我写段落的 pending 日记
 * - mine：我发起、等待对方的 pending 日记
 */
export async function loadCollabCards(viewerId: string, spaceId: string) {
  const membership = await prisma.spaceMember.findFirst({
    where: { spaceId, userId: viewerId },
    include: { space: { include: { members: true } } },
  });
  const partner = membership?.space.members.find(
    (m) => m.userId !== viewerId,
  );
  if (!partner) return { incoming: null, mine: null };

  const [incomingRow, mineRow] = await Promise.all([
    prisma.entry.findFirst({
      where: {
        spaceId,
        collabStatus: "pending",
        authorId: partner.userId,
      },
      include: { sections: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.entry.findFirst({
      where: {
        spaceId,
        collabStatus: "pending",
        authorId: viewerId,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, day: true, title: true },
    }),
  ]);

  const incoming = incomingRow
    ? (() => {
        const mineSection =
          incomingRow.sections.find((s) => s.authorId === viewerId) ?? null;
        const partnerSection =
          incomingRow.sections.find((s) => s.authorId === partner.userId) ??
          null;
        return {
          entryId: incomingRow.id,
          day: incomingRow.day,
          title: incomingRow.title,
          authorNickname: partner.nickname,
          mySectionSubmitted: Boolean(mineSection && !mineSection.confirmedAt),
          iConfirmed: Boolean(mineSection?.confirmedAt),
          partnerConfirmed: Boolean(partnerSection?.confirmedAt),
        };
      })()
    : null;

  const mine = mineRow
    ? { entryId: mineRow.id, day: mineRow.day, title: mineRow.title }
    : null;
  return { incoming, mine };
}
