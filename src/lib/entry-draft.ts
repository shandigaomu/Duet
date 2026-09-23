import { shanghaiDay } from "@/lib/space";

export type EntryDraft = {
  day: string;
  title: string;
  body: string;
  /** 已上传的持久 URL（不含 blob） */
  imageUrls: string[];
  updatedAt: number;
};

function draftKey(userId: string, spaceId: string) {
  return `duet.entry.draft.${spaceId}.${userId}`;
}

export function loadEntryDraft(
  userId: string,
  spaceId: string,
): EntryDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(userId, spaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EntryDraft;
    if (!parsed || typeof parsed.body !== "string") return null;
    return {
      day:
        typeof parsed.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.day)
          ? parsed.day
          : shanghaiDay(),
      title: typeof parsed.title === "string" ? parsed.title : "",
      body: parsed.body,
      imageUrls: Array.isArray(parsed.imageUrls)
        ? parsed.imageUrls.filter((u) => typeof u === "string").slice(0, 9)
        : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveEntryDraft(
  userId: string,
  spaceId: string,
  draft: Omit<EntryDraft, "updatedAt">,
) {
  if (typeof window === "undefined") return;
  const empty =
    !draft.body.trim() && !draft.title.trim() && draft.imageUrls.length === 0;
  if (empty) {
    clearEntryDraft(userId, spaceId);
    return;
  }
  try {
    const payload: EntryDraft = { ...draft, updatedAt: Date.now() };
    localStorage.setItem(draftKey(userId, spaceId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearEntryDraft(userId: string, spaceId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftKey(userId, spaceId));
  } catch {
    /* ignore */
  }
}
