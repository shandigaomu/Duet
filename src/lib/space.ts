const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 6 位邀请码，易读无易混字符 */
export function generateInviteCode(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/** Asia/Shanghai 自然日 YYYY-MM-DD */
export function shanghaiDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** P0-2：在一起第 N 天（含当天起算）；未来日期返回负数偏移 */
export function daysSinceAnniversary(
  anniversaryDay: string,
  today = shanghaiDay(),
): number | null {
  const pa = anniversaryDay.split("-").map(Number);
  const pt = today.split("-").map(Number);
  if (!pa[0] || !pt[0]) return null;
  const aMs = Date.UTC(pa[0], pa[1]! - 1, pa[2]!);
  const tMs = Date.UTC(pt[0], pt[1]! - 1, pt[2]!);
  return Math.round((tMs - aMs) / 86_400_000) + 1;
}
