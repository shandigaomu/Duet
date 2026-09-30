export type MoodId = "happy" | "ok" | "sad";

export type CheckIn = {
  mood: MoodId | null;
  line: string;
  note: string;
  imageUrl: string | null;
  updatedAt: string; // ISO
  /** 对方是否已读「我」的内容；仅 me 侧有意义 */
  partnerReadAt: string | null;
};

export const MOODS = [
  { id: "happy", label: "开心", emoji: "😄" },
  { id: "ok", label: "一般", emoji: "😐" },
  { id: "sad", label: "沮丧", emoji: "😞" },
] as const satisfies ReadonlyArray<{
  id: MoodId;
  label: string;
  emoji: string;
}>;

export const MOOD_BY_ID: Record<
  MoodId,
  { id: MoodId; label: string; emoji: string }
> = {
  happy: MOODS[0],
  ok: MOODS[1],
  sad: MOODS[2],
};

export const LINE_MAX = 60;
export const NOTE_MAX = 200;

export function formatSyncTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatTodayLabel(date = new Date()) {
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 · 周${weekdays[date.getDay()]}`;
}

// —— P1-2 心情周报（轻量版） ——

export type WeeklyMoodSide = {
  happy: number;
  ok: number;
  sad: number;
  /** 写了几日（有 line 即算） */
  days: number;
};

export type WeeklyMoodWeek = {
  /** 周一日期 YYYY-MM-DD */
  start: string;
  me: WeeklyMoodSide;
  you: WeeklyMoodSide;
};

export type WeeklyMoodRow = {
  day: string;
  authorIsMe: boolean;
  mood: string | null;
};

export const WEEKLY_MOOD_WEEKS = 8;

/** 最近 n 周的周一（含本周），返回从旧到新的周一日期列表 */
export function recentWeekStarts(
  thisWeekStart: string,
  n = WEEKLY_MOOD_WEEKS,
): string[] {
  const [y, m, d] = thisWeekStart.split("-").map(Number);
  const baseMs = Date.UTC(y!, m! - 1, d!);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const ms = baseMs - i * 7 * 86_400_000;
    const dt = new Date(ms);
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`,
    );
  }
  return out;
}

function emptySide(): WeeklyMoodSide {
  return { happy: 0, ok: 0, sad: 0, days: 0 };
}

/**
 * 将 8 周内的 CheckIn 行聚合为每周双方心情堆叠。
 * 行需满足：day 在 [weeks[0], 本周日终] 内（调用方保证）；窗口外的行被忽略。
 */
export function aggregateWeeklyMood(
  rows: WeeklyMoodRow[],
  thisWeekStart: string,
  n = WEEKLY_MOOD_WEEKS,
): WeeklyMoodWeek[] {
  const starts = recentWeekStarts(thisWeekStart, n);
  const weeks: WeeklyMoodWeek[] = starts.map((start) => ({
    start,
    me: emptySide(),
    you: emptySide(),
  }));

  // 快速定位：day → 周序号（自首周周一的日历差 / 7）
  const first = starts[0]!;
  const [fy, fm, fd] = first.split("-").map(Number);
  const firstMs = Date.UTC(fy!, fm! - 1, fd!);

  for (const row of rows) {
    const [y, m, d] = row.day.split("-").map(Number);
    if (!y || !m || !d) continue;
    const dayMs = Date.UTC(y, m - 1, d);
    const idx = Math.floor((dayMs - firstMs) / (7 * 86_400_000));
    if (idx < 0 || idx >= weeks.length) continue;
    const week = weeks[idx]!;
    const side = row.authorIsMe ? week.me : week.you;
    side.days += 1;
    if (row.mood === "happy" || row.mood === "ok" || row.mood === "sad") {
      side[row.mood] += 1;
    }
  }
  return weeks;
}

/** 摘要：本周共同记录天数 / 连续共同记录周数（双方都有即算共同） */
export function weeklyMoodSummary(weeks: WeeklyMoodWeek[]): {
  togetherDaysThisWeek: number;
  togetherWeeksStreak: number;
} {
  if (weeks.length === 0) return { togetherDaysThisWeek: 0, togetherWeeksStreak: 0 };
  const last = weeks[weeks.length - 1]!;
  const togetherDaysThisWeek = Math.min(last.me.days, last.you.days) > 0
    ? countTogetherDays(last)
    : 0;

  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i]!;
    if (w.me.days > 0 && w.you.days > 0) streak += 1;
    else break;
  }
  return { togetherDaysThisWeek, togetherWeeksStreak: streak };
}

function countTogetherDays(w: WeeklyMoodWeek): number {
  // 轻量版不存逐日明细，以双方天数较小者近似共同天数
  return Math.min(w.me.days, w.you.days);
}

// —— P3-T10 连续共同记录徽章（两档，达不成安静消失，绝不断签提示） ——

export type StreakBadgeInput = {
  /** 近 n 周（含本周）的 CheckIn 日期行，authorIsMe 区分双方 */
  days: Array<{ day: string; authorIsMe: boolean }>;
  /** 本周周一 YYYY-MM-DD */
  thisWeekStart: string;
};

export type StreakBadge =
  | { kind: "week-days"; days: number; line: string }
  | { kind: "weeks-streak"; weeks: number; line: string }
  | null;

const WEEK_BADGE_THRESHOLD = 5;
const STREAK_BADGE_THRESHOLD = 4;

/**
 * 两档徽章：本周共同记录 ≥ 5 天（优先）；否则连续 ≥ 4 周都有共同记录。
 * 共同 = 同一天双方都有；达不成返回 null（安静消失）。
 */
export function streakBadge(input: StreakBadgeInput): StreakBadge {
  const byDay = new Map<string, { me: boolean; you: boolean }>();
  for (const d of input.days) {
    const b = byDay.get(d.day) ?? { me: false, you: false };
    if (d.authorIsMe) b.me = true;
    else b.you = true;
    byDay.set(d.day, b);
  }

  const together = [...byDay.entries()]
    .filter(([, b]) => b.me && b.you)
    .map(([day]) => day)
    .sort();

  // 档一：本周共同天数
  const thisWeekDays = together.filter((d) => d >= input.thisWeekStart).length;
  if (thisWeekDays >= WEEK_BADGE_THRESHOLD) {
    return {
      kind: "week-days",
      days: thisWeekDays,
      line: `本周已共同记录 ${thisWeekDays} 天 🌿`,
    };
  }

  // 档二：连续共同周数（含本周；共同 = 该周至少 1 天双方都有）
  const weekStarts = recentWeekStarts(input.thisWeekStart, 6);
  let streak = 0;
  for (let i = weekStarts.length - 1; i >= 0; i--) {
    const start = weekStarts[i]!;
    const end =
      i < weekStarts.length - 1
        ? weekStarts[i + 1]!
        : "9999-12-31"; // 本周取全部
    const has = together.some((d) => d >= start && d < end);
    if (has) streak += 1;
    else break;
  }
  if (streak >= STREAK_BADGE_THRESHOLD) {
    return {
      kind: "weeks-streak",
      weeks: streak,
      line: `连续 ${streak} 周都在记录 🌿`,
    };
  }

  return null;
}
