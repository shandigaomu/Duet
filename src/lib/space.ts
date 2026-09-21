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
