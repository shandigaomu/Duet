import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * P2-N6 隐私锁 v1（4 位 PIN，锁在服务端）。
 * - AppLock.pinHash：scrypt(pin, salt) 存储
 * - 解锁 Cookie：HMAC(userId.expiry) 签名，12 小时有效，HttpOnly
 * - enabled 标志缓存在 Cookie payload 内，避免每次请求查库
 */

const LOCK_COOKIE = "duet_lock";
const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000;

function lockSecret(): string {
  return (
    process.env.APP_LOCK_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    "duet-dev-lock-secret"
  );
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function sign(payload: string): string {
  return createHmac("sha256", lockSecret()).update(payload).digest("base64url");
}

/** 解锁成功：签发 12h Cookie（payload 带 userId + 过期时间） */
export async function sealLockCookie(userId: string) {
  const expiresAt = Date.now() + UNLOCK_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const value = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(LOCK_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UNLOCK_TTL_MS / 1000,
  });
}

export type LockCheckResult =
  | { state: "no-lock" } // 用户未开启锁
  | { state: "locked" } // 需要过锁屏
  | { state: "unlocked" }; // Cookie 有效

export async function checkLockCookie(userId: string): Promise<LockCheckResult> {
  const store = await cookies();
  const raw = store.get(LOCK_COOKIE)?.value;
  if (!raw) return { state: "locked" };

  const idx = raw.lastIndexOf(".");
  if (idx <= 0) return { state: "locked" };
  const payload = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return { state: "locked" };
  }
  const [payloadUserId, expiresAt] = payload.split(".");
  if (payloadUserId !== userId) return { state: "locked" };
  if (!expiresAt || Number(expiresAt) < Date.now()) return { state: "locked" };
  return { state: "unlocked" };
}

/** 上锁 = 删 Cookie */
export async function clearLockCookie() {
  const store = await cookies();
  store.delete(LOCK_COOKIE);
}

/** 用户是否开启了锁 */
export async function appLockEnabled(userId: string): Promise<boolean> {
  const row = await prisma.appLock.findUnique({ where: { userId } });
  return Boolean(row);
}

/** 组合检查：requirePaired 头部调用 */
export async function lockGate(userId: string): Promise<LockCheckResult> {
  const enabled = await appLockEnabled(userId);
  if (!enabled) return { state: "no-lock" };
  return checkLockCookie(userId);
}

// —— 错误计数（进程内缓存即可：错 5 次登出的窗口本身很短） —--
const failCounts = new Map<string, { count: number; firstAt: number }>();
const FAIL_WINDOW_MS = 10 * 60 * 1000;

export function recordLockFail(userId: string): number {
  const now = Date.now();
  const cur = failCounts.get(userId);
  if (!cur || now - cur.firstAt > FAIL_WINDOW_MS) {
    failCounts.set(userId, { count: 1, firstAt: now });
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

export function clearLockFails(userId: string) {
  failCounts.delete(userId);
}
