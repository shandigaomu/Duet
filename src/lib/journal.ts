export const TITLE_MAX = 120;
export const BODY_MAX = 20_000;
export const IMAGE_MAX = 9;

export type TimelineFilter =
  | "all"
  | "mine"
  | "yours"
  | "week"
  | "thisMonth"
  | "month";

export type EntryImageDTO = {
  id: string;
  url: string;
  sortOrder: number;
};

export type EntryVisibility = "shared" | "private";

export type EntryReactionDTO = {
  emoji: string;
  body: string | null;
};

export type EntryDTO = {
  id: string;
  day: string;
  title: string | null;
  body: string;
  visibility: EntryVisibility;
  authorId: string;
  authorSide: "me" | "you";
  authorNickname: string;
  images: EntryImageDTO[];
  /** 对方是否已读（仅作者侧有意义） */
  partnerReadAt: string | null;
  /** 我的回应（P0-1，仅自己看自己回应） */
  myReaction: EntryReactionDTO | null;
  /** 对方的回应 */
  partnerReaction: EntryReactionDTO | null;
  createdAt: string;
  updatedAt: string;
};

/** P0-1 预设表情（有序，不开放自定义） */
export const REACTION_EMOJIS = ["❤️", "🤗", "😂", "😮", "😢"] as const;
export const REACTION_BODY_MAX = 60;

export type EntryListItem = {
  kind: "entry";
  id: string;
  day: string;
  title: string | null;
  bodyPreview: string;
  visibility: EntryVisibility;
  authorSide: "me" | "you";
  authorNickname: string;
  imageUrls: string[];
  partnerReadAt: string | null;
  /** 我是否已回应（时间线小标，仅自己的日记有意义） */
  myReactionAt: string | null;
  createdAt: string;
};

export type CheckInSnapshotItem = {
  kind: "checkin";
  id: string;
  day: string;
  mineLine: string | null;
  yoursLine: string | null;
  mineMood: string | null;
  yoursMood: string | null;
};

export type TimelineItem = EntryListItem | CheckInSnapshotItem;

export type TimelineStats = {
  total: number;
  mine: number;
  yours: number;
  month: number;
};

/** P1-1 那年今日：历史同日日记（最多 3 条，同年多条取最新） */
export type OnThisDayItem = {
  id: string;
  day: string;
  yearsAgo: number;
  title: string | null;
  bodyPreview: string;
};

/** P3-T3 清单那年完成：历史同日完成的清单项 */
export type OnThisDayListItem = {
  id: string;
  completedAt: string;
  yearsAgo: number;
  title: string;
  categoryLabel: string;
};

/**
 * P3-T3：从历年同月日完成的清单行归并为最多 limit 条（每年取一条，最近年份在前）。
 * completedDay 形如 YYYY-MM-DD，仅月日参与匹配；今年及未来的行由调用方过滤。
 */
export function pickOnThisDayLists(
  rows: Array<{
    id: string;
    completedDay: string;
    title: string;
    categoryLabel: string;
  }>,
  today: string,
  limit = 2,
): OnThisDayListItem[] {
  const md = today.slice(5);
  const thisYear = Number(today.slice(0, 4));
  const byYear = new Map<
    number,
    { id: string; completedDay: string; title: string; categoryLabel: string }
  >();
  for (const r of rows) {
    const y = Number(r.completedDay.slice(0, 4));
    if (!y || y >= thisYear) continue;
    if (r.completedDay.slice(5) !== md) continue;
    const prev = byYear.get(y);
    // 同年多条取完成时间更晚的（id 大者兜底稳定）
    if (
      !prev ||
      r.completedDay > prev.completedDay ||
      (r.completedDay === prev.completedDay && r.id > prev.id)
    ) {
      byYear.set(y, r);
    }
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([year, r]) => ({
      id: r.id,
      completedAt: r.completedDay,
      yearsAgo: thisYear - year,
      title: r.title,
      categoryLabel: r.categoryLabel,
    }));
}

/** 3.18 */
export function formatDayShort(day: string) {
  const [, m, d] = day.split("-");
  return `${Number(m)}.${Number(d)}`;
}

/** 3月 */
export function formatMonthHeading(day: string) {
  const [, m] = day.split("-");
  return `${Number(m)}月`;
}

export function previewBody(body: string, max = 72) {
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}…`;
}

/** Asia/Shanghai YYYY-MM */
export function shanghaiMonth(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  })
    .format(date)
    .slice(0, 7);
}

/** 本周（周一～周日）起止 YYYY-MM-DD，Asia/Shanghai */
export function shanghaiWeekRange(date = new Date()): {
  start: string;
  end: string;
} {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [y, m, d] = today.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d!);
  const wd = new Date(utc).getUTCDay(); // 0=Sun
  const mondayOffset = wd === 0 ? -6 : 1 - wd;
  const startMs = utc + mondayOffset * 86_400_000;
  const endMs = startMs + 6 * 86_400_000;
  const fmt = (ms: number) => {
    const dt = new Date(ms);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };
  return { start: fmt(startMs), end: fmt(endMs) };
}

/** P1-1：今天月日（MM-DD），Asia/Shanghai */
export function shanghaiMonthDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 本周周一 YYYY-MM-DD（Asia/Shanghai）——P3-T10 徽章用 */
export function shanghaiWeekStart(date = new Date()): string {
  return shanghaiWeekRange(date).start;
}

/**
 * P1-1：从历史同日行归并为最多 limit 条（每年取最新一条，按年份差降序=最近年份在前）。
 * 输入行需含 id/day/title/body；day 均以 -MM-DD 结尾且早于今年。
 */
export type OnThisDayRow = {
  id: string;
  day: string;
  title: string | null;
  body: string;
};

export function pickOnThisDay(
  rows: OnThisDayRow[],
  today: string,
  limit = 3,
): OnThisDayItem[] {
  const byYear = new Map<number, OnThisDayRow>();
  for (const r of rows) {
    const y = Number(r.day.slice(0, 4));
    if (!y || y >= Number(today.slice(0, 4))) continue;
    const prev = byYear.get(y);
    // 同年多条取最新（day 更大者；day 相同取 id 较大保证稳定）
    if (!prev || r.day > prev.day || (r.day === prev.day && r.id > prev.id)) {
      byYear.set(y, r);
    }
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([year, r]) => ({
      id: r.id,
      day: r.day,
      yearsAgo: Number(today.slice(0, 4)) - year,
      title: r.title,
      bodyPreview: previewBody(r.body, 48),
    }));
}
