import { z } from "zod";

export const LIST_TITLE_MAX = 80;

export const LIST_CATEGORIES = [
  { id: "go", label: "想去的" },
  { id: "eat", label: "想吃的" },
  { id: "do", label: "想做的" },
] as const;

export type ListCategory = (typeof LIST_CATEGORIES)[number]["id"];

export const listItemSchema = z.object({
  category: z.enum(["go", "eat", "do"]),
  title: z
    .string()
    .trim()
    .min(1, "请填写内容")
    .max(LIST_TITLE_MAX, `最多 ${LIST_TITLE_MAX} 字`),
});

export type ListItemDTO = {
  id: string;
  category: ListCategory;
  title: string;
  status: "open" | "done";
  completedAt: string | null;
  authorId: string;
  authorSide: "me" | "you";
  authorNickname: string;
  createdAt: string;
};

export function categoryLabel(id: string) {
  return LIST_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
