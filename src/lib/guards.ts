import { redirect } from "next/navigation";
import { getPairingState, requireUser } from "@/lib/session";

/** 主应用布局：必须登录且已配对（2 人） */
export async function requirePaired() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const pairing = await getPairingState(user.id);
  if (pairing.status === "none") redirect("/create");
  if (pairing.status === "waiting") redirect("/create");
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
