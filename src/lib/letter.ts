import { z } from "zod";

/** P2-N3 时光信：写给未来的信 */
export const LETTER_BODY_MAX = 2_000;
export const LETTER_TITLE_MAX = 120;

export const letterSchema = z.object({
  title: z
    .string()
    .trim()
    .max(LETTER_TITLE_MAX, "标题最长 120 字")
    .optional()
    .nullable(),
  body: z
    .string()
    .trim()
    .min(1, "写点什么吧")
    .max(LETTER_BODY_MAX, `正文最长 ${LETTER_BODY_MAX} 字`),
  unlockDay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "解锁日格式无效"),
  imageUrl: z
    .string()
    .max(512)
    .optional()
    .nullable(),
});

export type LetterInput = z.infer<typeof letterSchema>;

export type LetterState = "sealed" | "unlocking" | "opened";

export type LetterDTO = {
  id: string;
  title: string | null;
  /** 未解锁且非作者时返回 null（收信方不可见内容） */
  body: string | null;
  imageUrl: string | null;
  unlockDay: string;
  state: LetterState;
  isMine: boolean;
  authorNickname: string;
  createdAt: string;
  /** P3-T4：距解锁天数（sealed 状态 ≥ 1；unlocking = 0；opened 为 null） */
  daysLeft: number | null;
};

/** 信的状态：解锁日之前 sealed；当天 unlocking；之后 opened */
export function letterState(unlockDay: string, today: string): LetterState {
  if (unlockDay > today) return "sealed";
  if (unlockDay === today) return "unlocking";
  return "opened";
}

/** P3-T4：距解锁还有几天（0 = 今天解锁；负数 = 已过） */
export function daysUntilUnlock(unlockDay: string, today: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(unlockDay) - parse(today)) / 86_400_000);
}

/** 列表 DTO 组装：sealed 状态下收信方看不到正文 */
export function toLetterDTO(
  row: {
    id: string;
    title: string | null;
    body: string;
    imageUrl: string | null;
    unlockDay: string;
    authorId: string;
    createdAt: Date;
  },
  opts: { viewerId: string; today: string },
): LetterDTO {
  const isMine = row.authorId === opts.viewerId;
  const state = letterState(row.unlockDay, opts.today);
  return {
    id: row.id,
    title: row.title,
    body: !isMine && state === "sealed" ? null : row.body,
    imageUrl: row.imageUrl,
    unlockDay: row.unlockDay,
    state,
    isMine,
    authorNickname: isMine ? "我" : "TA",
    createdAt: row.createdAt.toISOString(),
    daysLeft: state === "sealed" ? daysUntilUnlock(row.unlockDay, opts.today) : state === "unlocking" ? 0 : null,
  };
}
