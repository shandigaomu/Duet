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
  createdAt: string;
  updatedAt: string;
};

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
