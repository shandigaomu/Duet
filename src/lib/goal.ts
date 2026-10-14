import { z } from "zod";

export const GOAL_TITLE_MAX = 40;
export const GOAL_NOTE_MAX = 200;
export const GOAL_STEP_TITLE_MAX = 60;
/** P3-T11 边界：步骤数上限防刷 */
export const GOAL_STEP_MAX = 20;
/** P3-T11 边界：同时进行的目标最多 5 个（超了说明不是目标是大包大揽） */
export const GOAL_ACTIVE_MAX = 5;

export const goalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "给目标起个名字")
    .max(GOAL_TITLE_MAX, `最多 ${GOAL_TITLE_MAX} 字`),
  note: z
    .string()
    .trim()
    .max(GOAL_NOTE_MAX, `最多 ${GOAL_NOTE_MAX} 字`)
    .optional()
    .default(""),
  /** 可选目标日 YYYY-MM-DD */
  targetDay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "目标日格式无效")
    .optional()
    .nullable(),
});

export const goalStepSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "请填写步骤")
    .max(GOAL_STEP_TITLE_MAX, `最多 ${GOAL_STEP_TITLE_MAX} 字`),
});

export type GoalStepDTO = {
  id: string;
  title: string;
  /** 完成者 userId（null = 未完成）；双人双色对勾用 */
  doneById: string | null;
  doneByMe: boolean;
  doneNickname: string;
  doneAt: string | null;
};

export type GoalDTO = {
  id: string;
  title: string;
  note: string | null;
  targetDay: string | null;
  /** open | done */
  status: "open" | "done";
  completedAt: string | null;
  createdAt: string;
  /** P3-T11：距目标日天数（null = 没设目标日；负数 = 已过期） */
  daysLeft: number | null;
  doneCount: number;
  totalCount: number;
  /** 快完成时的小标记（差 1 步，只陈述不催） */
  nearlyDone: boolean;
  steps: GoalStepDTO[];
};

export function daysUntilGoal(targetDay: string, today: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(targetDay) - parse(today)) / 86_400_000);
}

/**
 * P5-O6：目标日倒计时文案的单一实现（P4-W6 引入，原在 TodayView/GoalsView 手写两份）。
 * 只陈述不告警：还剩 N 天 / 就是今天 / 目标日已过 N 天；分隔前缀由调用方定。
 */
export function dayLeftLine(daysLeft: number, sep = ""): string {
  if (daysLeft > 0) return `${sep}还剩 ${daysLeft} 天`;
  if (daysLeft === 0) return `${sep}就是今天`;
  return `${sep}目标日已过 ${-daysLeft} 天`;
}

export type GoalRow = {
  id: string;
  title: string;
  note: string | null;
  targetDay: string | null;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  steps: Array<{
    id: string;
    title: string;
    doneById: string | null;
    doneAt: Date | null;
    createdAt: Date;
    sortOrder: number;
  }>;
};

/** DTO 组装：doneById → 双人侧别与昵称由调用方灌入 */
export function toGoalDTO(
  row: GoalRow,
  opts: {
    viewerId: string;
    today: string;
    nickname: (userId: string | null) => string;
  },
): GoalDTO {
  const steps = [...row.steps]
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .map((s) => ({
      id: s.id,
      title: s.title,
      doneById: s.doneById,
      doneByMe: s.doneById === opts.viewerId,
      doneNickname: opts.nickname(s.doneById),
      doneAt: s.doneAt?.toISOString() ?? null,
    }));
  const doneCount = steps.filter((s) => s.doneById).length;
  const status = row.status === "done" ? "done" : "open";
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    targetDay: row.targetDay,
    status,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    daysLeft:
      row.targetDay && status === "open"
        ? daysUntilGoal(row.targetDay, opts.today)
        : null,
    doneCount,
    totalCount: steps.length,
    // 快完成时的小标记（差 1 步；只陈述不催）
    nearlyDone:
      status === "open" && steps.length > 0 && doneCount === steps.length - 1,
    steps,
  };
}
