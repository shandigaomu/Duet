"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { auth } from "@/lib/auth";
import {
  appLockEnabled,
  clearLockCookie,
  clearLockFails,
  hashPin,
  recordLockFail,
  sealLockCookie,
  verifyPin,
} from "@/lib/app-lock";

const FAIL_LIMIT = 5;

export type LockResult = { ok: boolean; error?: string; lockedOut?: boolean };

/** P2-N6：开启锁（设 4 位 PIN，输两遍）并立即上锁态由前端引导解锁或保持 */
export async function enableAppLockAction(input: {
  pin: string;
  pinConfirm: string;
}): Promise<LockResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "请先登录" };

  const pin = input.pin.trim();
  const confirm = input.pinConfirm.trim();
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "PIN 需为 4 位数字" };
  if (pin !== confirm) return { ok: false, error: "两次输入不一致" };

  await prisma.appLock.upsert({
    where: { userId: user.id },
    create: { userId: user.id, pinHash: hashPin(pin) },
    update: { pinHash: hashPin(pin) },
  });

  // 开启后要求重新解锁（新标签页效果一致）
  await clearLockCookie();
  revalidatePath("/me");
  return { ok: true };
}

/** 关闭锁：需先解锁（Cookie 有效）+ 二次确认由前端处理 */
export async function disableAppLockAction(): Promise<LockResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "请先登录" };

  const row = await prisma.appLock.findUnique({ where: { userId: user.id } });
  if (!row) return { ok: true };

  await prisma.appLock.delete({ where: { userId: user.id } });
  await clearLockCookie();
  clearLockFails(user.id);
  revalidatePath("/me");
  return { ok: true };
}

/** 手动上锁 = 删解锁 Cookie */
export async function lockNowAction(): Promise<LockResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "请先登录" };
  if (!(await appLockEnabled(user.id))) {
    return { ok: false, error: "未开启隐私锁" };
  }
  await clearLockCookie();
  revalidatePath("/today");
  return { ok: true };
}

/** 解锁：PIN 比对；错 5 次强制登出（防沙） */
export async function unlockAppAction(input: {
  pin: string;
}): Promise<LockResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "请先登录" };

  const row = await prisma.appLock.findUnique({ where: { userId: user.id } });
  if (!row) {
    // 锁已被关闭：直接放行回今日
    redirect("/today");
  }

  const pin = input.pin.trim();
  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, error: "请输入 4 位数字" };
  }
  if (!verifyPin(pin, row.pinHash)) {
    const fails = recordLockFail(user.id);
    if (fails >= FAIL_LIMIT) {
      clearLockFails(user.id);
      await auth.api.signOut({ headers: new Headers() }).catch(() => undefined);
      redirect("/login");
    }
    return {
      ok: false,
      error: `PIN 不对，还剩 ${FAIL_LIMIT - fails} 次机会`,
    };
  }

  clearLockFails(user.id);
  await sealLockCookie(user.id);
  revalidatePath("/today");
  return { ok: true };
}

/** 锁屏页与设置页共用的状态查询 */
export async function loadAppLockState(): Promise<{
  enabled: boolean;
  unlocked: boolean;
}> {
  const user = await requireUser();
  if (!user) return { enabled: false, unlocked: false };
  const enabled = await appLockEnabled(user.id);
  if (!enabled) return { enabled: false, unlocked: false };
  const { checkLockCookie } = await import("@/lib/app-lock");
  const check = await checkLockCookie(user.id);
  return { enabled, unlocked: check.state === "unlocked" };
}
