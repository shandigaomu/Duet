import { z } from "zod";

export const NOTE_BODY_MAX = 500;

export const noteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "请写一句")
    .max(NOTE_BODY_MAX, `最多 ${NOTE_BODY_MAX} 字`),
  parentId: z.string().optional().nullable(),
  /** P3-T8：阅后即焚（默认关；对方已读起 24h 后焚毁，不进回收站） */
  burnAfterReading: z.boolean().optional().default(false),
});

export const BURN_AFTER_READ_MS = 24 * 60 * 60 * 1000;

export type NoteDTO = {
  id: string;
  body: string;
  parentId: string | null;
  pinned: boolean;
  authorId: string;
  authorSide: "me" | "you";
  authorNickname: string;
  createdAt: string;
  replies: NoteDTO[];
  /** P3-T8：阅后即焚标记（我发的自己永远可见，标灰 + 🔥） */
  burn: boolean;
  /** P3-T8：对方已读时间（仅我自己看的燃烧中信息用） */
  readAt: string | null;
  /** P3-T8：焚毁时刻 = readAt + 24h（仅计算给发送方展示） */
  burnAt: string | null;
};
