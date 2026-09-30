import { createHash } from "crypto";

/**
 * P3-T5 一起看（回忆抽签）：
 * 双方同一天必抽到同一篇——随机种子 = hash(spaceId + today)，
 * 候选按 id 稳定排序后取模命中。零新表零状态。
 */

/** 太新的日记不算「回忆」 */
export const RECALL_MIN_AGE_DAYS = 90;

export type RecallRow = {
  id: string;
  day: string;
  title: string | null;
  body: string;
};

export type RecallPick = {
  entry: RecallRow;
  /** 候选总数（空态判断用） */
  poolSize: number;
  /** 年份差（今天 - 日记年），≥ 1 */
  yearsAgo: number;
  preview: string;
};

/** 与服务端 shanghaiDay 同构的种子日期：调用方传入，这里只做纯计算 */
export function recallSeed(spaceId: string, today: string): number {
  const h = createHash("sha256").update(`${spaceId}:${today}`).digest();
  return h.readUInt32BE(0);
}

export function previewRecallBody(body: string, max = 64): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}…`;
}

/**
 * 从候选行中按种子抽一篇。
 * 行必须已按服务端可见性过滤（shared/未删/非 pending），此处只负责确定性选择。
 * 同空间同天传入相同行集（调用方保证），两人必命中同一篇。
 */
export function pickRecall(
  rows: RecallRow[],
  spaceId: string,
  today: string,
): RecallPick | null {
  if (rows.length === 0) return null;
  // 按 (day, id) 稳定排序，保证两人候选顺序一致
  const sorted = rows
    .slice()
    .sort((a, b) => (a.day !== b.day ? a.day.localeCompare(b.day) : a.id.localeCompare(b.id)));
  const seed = recallSeed(spaceId, today);
  const picked = sorted[seed % sorted.length]!;
  const thisYear = Number(today.slice(0, 4));
  const entryYear = Number(picked.day.slice(0, 4));
  return {
    entry: picked,
    poolSize: rows.length,
    yearsAgo: Math.max(1, thisYear - entryYear),
    preview: previewRecallBody(picked.body),
  };
}

/** 「还有 N 天」：两日期字符串差（YYYY-MM-DD），0 = 今天 */
export function daysBetweenDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}
