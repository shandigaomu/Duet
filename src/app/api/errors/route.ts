import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const reportSchema = z.object({
  reports: z
    .array(
      z.object({
        route: z.string().trim().min(1).max(120),
        kind: z.string().trim().min(1).max(24),
        message: z.string().trim().min(1).max(300),
        stack: z.string().trim().max(2000).optional(),
      }),
    )
    .min(1)
    .max(20),
});

/** 30 天前的错误顺手清理（挂在每次上报时，概率触发，免定时任务） */
let lastCleanup = 0;
async function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 24 * 60 * 60 * 1000) return;
  lastCleanup = now;
  try {
    await prisma.errorLog.deleteMany({
      where: { createdAt: { lt: new Date(now - 30 * 24 * 60 * 60 * 1000) } },
    });
  } catch {
    // 清理失败不影响主流程
  }
}

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = reportSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const session = await getSession();
    const userId = session?.user?.id ?? null;
    await prisma.errorLog.createMany({
      data: parsed.data.reports.map((r) => ({
        userId,
        route: r.route,
        kind: r.kind,
        message: r.message,
        stack: r.stack ?? null,
        ua: request.headers.get("user-agent")?.slice(0, 200) ?? null,
      })),
    });
    void maybeCleanup();
  } catch {
    // 上报接口自身绝不报错（避免错误风暴）
  }
  return NextResponse.json({ ok: true });
}
