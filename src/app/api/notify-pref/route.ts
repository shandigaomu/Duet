import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { emailConfigured } from "@/server/mail";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  emailEnabled: z.boolean(),
  emailWeekly: z.boolean(),
});

/** V3-N1/N2：GET 当前用户通知偏好 */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const pref = await prisma.notifyPref.findUnique({
    where: { userId: user.id },
  });
  return NextResponse.json({
    emailEnabled: pref?.emailEnabled ?? false,
    emailWeekly: pref?.emailWeekly ?? false,
    emailAvailable: emailConfigured(),
  });
}

/** PUT 更新邮件通知偏好 */
export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await prisma.notifyPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ ok: true });
}
