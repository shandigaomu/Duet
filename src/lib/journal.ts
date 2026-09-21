export const TITLE_MAX = 120;
export const BODY_MAX = 20_000;
export const IMAGE_MAX = 9;

export type TimelineFilter = "all" | "mine" | "yours" | "month";

export type EntryImageDTO = {
  id: string;
  url: string;
  sortOrder: number;
};

export type EntryDTO = {
  id: string;
  day: string;
  title: string | null;
  body: string;
  authorId: string;
  authorSide: "me" | "you";
  authorNickname: string;
  images: EntryImageDTO[];
  createdAt: string;
  updatedAt: string;
};

export type EntryListItem = {
  kind: "entry";
  id: string;
  day: string;
  title: string | null;
  bodyPreview: string;
  authorSide: "me" | "you";
  authorNickname: string;
  imageUrls: string[];
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
