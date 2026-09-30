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
