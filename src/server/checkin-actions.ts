"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { shanghaiDay } from "@/lib/space";
import type { CheckIn, MoodId } from "@/lib/checkin";
import { LINE_MAX, NOTE_MAX, recentWeekStarts, streakBadge } from "@/lib/checkin";
import { shanghaiWeekStart } from "@/lib/journal";
import { sendEventEmail } from "@/server/mail";
import {
  pushCheckinUpdated,
  pushHugReceived,
  pushToPartner,
} from "@/server/push";

function toClientCheckIn(row: {
  mood: string | null;
  line: string;
  note: string | null;
  imageUrl: string | null;
  updatedAt: Date;
  partnerReadAt: Date | null;
}): CheckIn {
  return {
    mood: (row.mood as MoodId | null) ?? null,
    line: row.line,
    note: row.note ?? "",
    imageUrl: row.imageUrl,
    updatedAt: row.updatedAt.toISOString(),
    partnerReadAt: row.partnerReadAt?.toISOString() ?? null,
  };
}

export async function loadTodayCheckIns() {
  const { user, membership } = await requirePaired();
  const day = shanghaiDay();
  const spaceId = membership.spaceId;
  const partner = membership.space.members.find((m) => m.userId !== user.id);

  const rows = await prisma.checkIn.findMany({
    where: { spaceId, day },
  });

  const mineRow = rows.find((r) => r.authorId === user.id) ?? null;
  let yoursRow = partner
    ? (rows.find((r) => r.authorId === partner.userId) ?? null)
    : null;
  const partnerWasUnread = Boolean(yoursRow && !yoursRow.partnerReadAt);

  // P2-N2：抱抱状态（今天这条 CheckIn 上的互动）
  const mineId = mineRow?.id ?? null;
  const yoursId = yoursRow?.id ?? null;
  const checkInIds = [mineId, yoursId].filter((x): x is string => Boolean(x));
  const hugs = checkInIds.length
    ? await prisma.checkInHug.findMany({
        where: { checkInId: { in: checkInIds } },
      })
    : [];
  const partnerHugOnMine = mineId
    ? (hugs.find((h) => h.checkInId === mineId && h.giverId !== user.id) ??
      null)
    : null;
  const myHugOnYours = yoursId
    ? (hugs.find((h) => h.checkInId === yoursId && h.giverId === user.id) ??
      null)
    : null;


  // B5：打开今日且对方有内容 → 标记对方条目已读
  if (yoursRow && !yoursRow.partnerReadAt) {
    yoursRow = await prisma.checkIn.update({
      where: { id: yoursRow.id },
      data: { partnerReadAt: new Date() },
    });
  }

  // P3-T10：近 6 周记录徽章（达不成安静消失）
  const thisWeekStart = shanghaiWeekStart();
  const sixWeeksAgo = recentWeekStarts(thisWeekStart, 6)[0]!;
  const recentRows = await prisma.checkIn.findMany({
    where: { spaceId, day: { gte: sixWeeksAgo } },
    select: { day: true, authorId: true },
  });
  const badge = streakBadge({
    days: recentRows.map((r) => ({
      day: r.day,
      authorIsMe: r.authorId === user.id,
    })),
    thisWeekStart,
  });

  return {
    day,
    mine: mineRow ? toClientCheckIn(mineRow) : null,
    yours: yoursRow ? toClientCheckIn(yoursRow) : null,
    partnerWasUnread,
    partnerNickname: partner?.nickname ?? "你",
    myNickname: membership.nickname,
    /** P2-N2：对方今天抱过我（+时间，当天有效） */
    hugFromPartner: partnerHugOnMine
      ? { at: partnerHugOnMine.createdAt.toISOString() }
      : null,
    /** P2-N2：我今天是否已抱过对方 */
    hugGivenByMe: Boolean(myHugOnYours),
    /** P3-T10：记录徽章（null = 达不成，安静消失） */
    streakBadge: badge,
  };
}

/** P2-N2：给对方的今日一个抱抱（每天每条限一次，唯一约束兜底） */
export async function hugTodayAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { user, membership } = await requirePaired();
  const partner = membership.space.members.find(
    (m) => m.userId !== user.id,
  );
  if (!partner) return { ok: false, error: "还未配对" };

  const target = await prisma.checkIn.findUnique({
    where: {
      spaceId_authorId_day: {
        spaceId: membership.spaceId,
        authorId: partner.userId,
        day: shanghaiDay(),
      },
    },
  });
  if (!target) return { ok: false, error: "TA 今天还没同步" };

  try {
    await prisma.checkInHug.create({
      data: { checkInId: target.id, giverId: user.id },
    });
  } catch {
    // 唯一约束冲突 = 已抱过，幂等成功
    return { ok: true };
  }

  // V3-N1：被抱抱通知（一天最多提一次——数据库层唯一约束天然限流）
  pushToPartner(partner.userId, user.id, pushHugReceived(membership.nickname));
  revalidatePath("/today");
  return { ok: true };
}

const saveSchema = z.object({
  mood: z.enum(["happy", "ok", "sad"]).nullable(),
  line: z.string().trim().min(1, "请写一句今天").max(LINE_MAX),
  note: z.string().trim().max(NOTE_MAX).optional().default(""),
  imageUrl: z.string().nullable().optional(),
});

export type SaveCheckInResult = {
  ok: boolean;
  error?: string;
  checkIn?: CheckIn;
};

export async function saveTodayCheckInAction(input: {
  mood: MoodId | null;
  line: string;
  note: string;
  imageUrl: string | null;
}): Promise<SaveCheckInResult> {
  const { user, membership } = await requirePaired();
  const day = shanghaiDay();
  const partner = membership.space.members.find((m) => m.userId !== user.id);

  // 允许 http(s) 与本地 /api/files 路径
  const imageUrl =
    input.imageUrl &&
    (input.imageUrl.startsWith("http://") ||
      input.imageUrl.startsWith("https://") ||
      input.imageUrl.startsWith("/api/files/"))
      ? input.imageUrl
      : null;

  const parsed = saveSchema.safeParse({
    mood: input.mood,
    line: input.line,
    note: input.note,
    imageUrl,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "参数无效",
    };
  }

  const row = await prisma.checkIn.upsert({
    where: {
      spaceId_authorId_day: {
        spaceId: membership.spaceId,
        authorId: user.id,
        day,
      },
    },
    create: {
      spaceId: membership.spaceId,
      authorId: user.id,
      day,
      mood: parsed.data.mood,
      line: parsed.data.line,
      note: parsed.data.note || null,
      imageUrl: parsed.data.imageUrl,
      partnerReadAt: null,
    },
    update: {
      mood: parsed.data.mood,
      line: parsed.data.line,
      note: parsed.data.note || null,
      imageUrl: parsed.data.imageUrl,
      // 覆盖更新后对方需重新已读
      partnerReadAt: null,
    },
  });

  revalidatePath("/today");

  // V3-N1/N2：通知对方（推送 + 可选邮件）
  pushToPartner(
    partner?.userId,
    user.id,
    pushCheckinUpdated(membership.nickname),
  );
  sendEventEmail(partner?.userId, user.id, membership.nickname, "checkin");

  return { ok: true, checkIn: toClientCheckIn(row) };
}
