"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { shanghaiDay } from "@/lib/space";
import type { CheckIn, MoodId } from "@/lib/checkin";
import { LINE_MAX, NOTE_MAX } from "@/lib/checkin";

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
    ? rows.find((r) => r.authorId === partner.userId) ?? null
    : null;

  const partnerWasUnread = Boolean(yoursRow && !yoursRow.partnerReadAt);

  // B5：打开今日且对方有内容 → 标记对方条目已读
  if (yoursRow && !yoursRow.partnerReadAt) {
    yoursRow = await prisma.checkIn.update({
      where: { id: yoursRow.id },
      data: { partnerReadAt: new Date() },
    });
  }

  return {
    day,
    mine: mineRow ? toClientCheckIn(mineRow) : null,
    yours: yoursRow ? toClientCheckIn(yoursRow) : null,
    partnerWasUnread,
    partnerNickname: partner?.nickname ?? "你",
    myNickname: membership.nickname,
  };
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
  return { ok: true, checkIn: toClientCheckIn(row) };
}
