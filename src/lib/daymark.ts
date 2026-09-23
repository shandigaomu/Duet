import { z } from "zod";
import { shanghaiDay } from "@/lib/space";

export const DAYMARK_TITLE_MAX = 40;
export const DAYMARK_NOTE_MAX = 200;
/** 今日页临近提示窗口（天） */
export const DAYMARK_HINT_WINDOW_DAYS = 7;

export const dayMarkSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式无效"),
  title: z
    .string()
    .trim()
    .min(1, "请填写标题")
    .max(DAYMARK_TITLE_MAX, `标题最多 ${DAYMARK_TITLE_MAX} 字`),
  note: z
    .string()
    .trim()
    .max(DAYMARK_NOTE_MAX, `备注最多 ${DAYMARK_NOTE_MAX} 字`)
    .optional()
    .nullable(),
  yearly: z.boolean().optional().default(false),
});

export type DayMarkDTO = {
  id: string;
  day: string;
  title: string;
  note: string | null;
  yearly: boolean;
  authorId: string;
  authorSide: "me" | "you";
  authorNickname: string;
  /** 相对今天的下次出现日（周年已换算） */
  nextDay: string;
  createdAt: string;
  updatedAt: string;
};

export type DayMarkHint = {
  id: string;
  title: string;
  nextDay: string;
  daysUntil: number;
  yearly: boolean;
  label: string;
};

function parseYmd(day: string): { y: number; m: number; d: number } {
  const [y, m, d] = day.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

/** 将 YYYY-MM-DD 视为上海自然日的日历差（按 UTC 正午避免 DST 干扰） */
export function daysBetween(a: string, b: string): number {
  const pa = parseYmd(a);
  const pb = parseYmd(b);
  const ta = Date.UTC(pa.y, pa.m - 1, pa.d);
  const tb = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((tb - ta) / 86_400_000);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** 某月最后一天（处理 2/29） */
function clampDay(y: number, m: number, d: number) {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.min(d, last);
}

/**
 * 下次出现日（含今天）。
 * 非周年：若 day < today 则视为已过，仍返回原 day。
 * 周年：取今年或明年同月日。
 */
export function nextOccurrence(
  day: string,
  yearly: boolean,
  today = shanghaiDay(),
): string {
  if (!yearly) return day;
  const { m, d } = parseYmd(day);
  const { y: ty } = parseYmd(today);
  const thisYear = ymd(ty, m, clampDay(ty, m, d));
  if (thisYear >= today) return thisYear;
  return ymd(ty + 1, m, clampDay(ty + 1, m, d));
}

export function isUpcoming(
  day: string,
  yearly: boolean,
  today = shanghaiDay(),
): boolean {
  const next = nextOccurrence(day, yearly, today);
  return next >= today;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

export function weekdayLabel(day: string): string {
  const { y, m, d } = parseYmd(day);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `周${WEEKDAY_LABELS[wd]}`;
}

export function formatHintLabel(
  title: string,
  nextDay: string,
  daysUntil: number,
): string {
  if (daysUntil === 0) return `今天 · ${title}`;
  if (daysUntil === 1) return `明天 · ${title}`;
  if (daysUntil <= 6) return `${weekdayLabel(nextDay)} · ${title}`;
  return `还有 ${daysUntil} 天 · ${title}`;
}

export function buildHint(
  mark: Pick<DayMarkDTO, "id" | "title" | "yearly" | "day">,
  today = shanghaiDay(),
): DayMarkHint | null {
  const nextDay = nextOccurrence(mark.day, mark.yearly, today);
  const daysUntil = daysBetween(today, nextDay);
  if (daysUntil < 0 || daysUntil > DAYMARK_HINT_WINDOW_DAYS) return null;
  return {
    id: mark.id,
    title: mark.title,
    nextDay,
    daysUntil,
    yearly: mark.yearly,
    label: formatHintLabel(mark.title, nextDay, daysUntil),
  };
}

export function splitUpcomingPast<T extends { nextDay: string }>(
  marks: T[],
  today = shanghaiDay(),
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const m of marks) {
    if (m.nextDay >= today) upcoming.push(m);
    else past.push(m);
  }
  upcoming.sort((a, b) => a.nextDay.localeCompare(b.nextDay));
  past.sort((a, b) => b.nextDay.localeCompare(a.nextDay));
  return { upcoming, past };
}

/** 月历格子：周一为一周起始 */
export function buildMonthGrid(month: string): {
  month: string;
  cells: ({ day: string; inMonth: boolean } | null)[];
} {
  const [ys, ms] = month.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const first = new Date(Date.UTC(y, m - 1, 1));
  // getUTCDay: 0=Sun … 转周一=0
  const startPad = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: ({ day: string; inMonth: boolean } | null)[] = [];

  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: ymd(y, m, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return { month, cells };
}

export function shiftMonth(month: string, delta: number): string {
  const [ys, ms] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(ys!, ms! - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
}

export function formatMonthTitle(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${Number(m)}月`;
}
