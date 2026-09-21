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
