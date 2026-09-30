import { redirect } from "next/navigation";
import { lockGate } from "@/lib/app-lock";
import { getPairingState, requireUser } from "@/lib/session";

/** 主应用布局：必须登录且已配对（2 人）+ 隐私锁门禁（P2-N6） */
export async function requirePaired() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const pairing = await getPairingState(user.id);
  if (pairing.status === "none") redirect("/create");
  if (pairing.status === "waiting") redirect("/create");

  // P2-N6：开了锁且未解锁 → 一律去锁屏（锁屏页不走 requirePaired）
  const lock = await lockGate(user.id);
  if (lock.state === "locked") redirect("/lock");

  return { user, membership: pairing.membership! };
}

/** 引导页：必须登录；已配对则进今日 */
export async function requireOnboarding() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const pairing = await getPairingState(user.id);
  if (pairing.status === "paired") redirect("/today");
  return { user, pairing };
}
