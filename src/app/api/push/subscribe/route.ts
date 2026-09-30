import { NextResponse } from "next/server";
import { z } from "zod";
import { getPairingState, requireUser } from "@/lib/session";
import {
  deleteSubscription,
  saveSubscription,
} from "@/server/push";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

/** V3-N1：POST /api/push/subscribe 保存/更新当前设备订阅 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }
  const pairing = await getPairingState(user.id);
  if (pairing.status !== "paired") {
    return NextResponse.json(
      { ok: false, error: "需完成配对" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "参数无效" }, { status: 400 });
  }
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "订阅信息无效" },
      { status: 400 },
    );
  }

  const res = await saveSubscription(
    user.id,
    parsed.data.subscription,
  );
  if (!res.ok) {
    return NextResponse.json(res, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/push/subscribe：取消当前设备订阅 */
export async function DELETE(request: Request) {
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
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await deleteSubscription(user.id, parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
