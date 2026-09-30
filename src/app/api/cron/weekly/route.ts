import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emailConfigured } from "@/server/mail";
import {
  collectWeeklySummary,
  sendWeeklySummaryEmail,
} from "@/server/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * V3-N2：每周一 9:00（上海）由外部 cron 触发（如 crontab / 云函数定时）：
 * curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/weekly
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ ok: true, skipped: "smtp-not-configured" });
  }

  const prefs = await prisma.notifyPref.findMany({
    where: { emailWeekly: true },
  });

  let sent = 0;
  for (const pref of prefs) {
    const membership = await prisma.spaceMember.findFirst({
      where: { userId: pref.userId },
    });
    if (!membership) continue;
    const summary = await collectWeeklySummary(
      membership.spaceId,
      pref.userId,
    );
    try {
      await sendWeeklySummaryEmail(pref.userId, summary);
      sent += 1;
    } catch {
      // 单人失败不阻断
    }
  }

  return NextResponse.json({ ok: true, sent });
}
