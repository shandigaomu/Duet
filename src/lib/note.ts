import { z } from "zod";

export const NOTE_BODY_MAX = 500;

export const noteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "请写一句")
    .max(NOTE_BODY_MAX, `最多 ${NOTE_BODY_MAX} 字`),
  parentId: z.string().optional().nullable(),
});

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
};
