"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePaired } from "@/lib/guards";
import { shanghaiDay } from "@/lib/space";
import {
  GOAL_ACTIVE_MAX,
  GOAL_STEP_MAX,
  daysUntilGoal,
  goalSchema,
  goalStepSchema,
  toGoalDTO,
  type GoalDTO,
} from "@/lib/goal";
import {
  pushGoalCompleted,
  pushGoalStepDone,
  pushToPartner,
} from "@/server/push";
import { sendEventEmail } from "@/server/mail";

type MembershipCtx = Awaited<ReturnType<typeof requirePaired>>;

function partnerOf(ctx: MembershipCtx) {
  return ctx.membership.space.members.find((m) => m.userId !== ctx.user.id);
}

function revalidateGoals() {
  revalidatePath("/us");
  revalidatePath("/us/goals");
  revalidatePath("/today");
}

async function loadCtx() {
  const ctx = await requirePaired();
  const partner = partnerOf(ctx);
  const nickname = (userId: string | null) =>
    userId == null
      ? ""
      : userId === ctx.user.id
        ? ctx.membership.nickname
        : (partner?.nickname ?? "你");
  return { ctx, partner, nickname };
}

export async function loadGoals(): Promise<{
  today: string;
  goals: GoalDTO[];
  partnerNickname: string;
}> {
  const { ctx, nickname } = await loadCtx();
  const today = shanghaiDay();
  const rows = await prisma.goal.findMany({
    where: { spaceId: ctx.membership.spaceId },
    include: { steps: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return {
    today,
    goals: rows.map((r) =>
      toGoalDTO(r, { viewerId: ctx.user.id, today, nickname }),
    ),
    partnerNickname: partnerOf(ctx)?.nickname ?? "你",
  };
}

/** P3-T11：今日页进度行——最新一个进行中目标（只一条，不堆） */
export async function loadGoalHint(): Promise<{
  id: string;
  title: string;
  doneCount: number;
  totalCount: number;
  targetDay: string | null;
  /** P4-W6：距目标日天数（null = 未设；0 = 就是今天；负 = 已过期未完成，只陈述不告警） */
  daysLeft: number | null;
} | null> {
  const { ctx } = await loadCtx();
  const today = shanghaiDay();
  const row = await prisma.goal.findFirst({
    where: { spaceId: ctx.membership.spaceId, status: "open" },
    include: { steps: true },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  const dto = toGoalDTO(row, {
    viewerId: ctx.user.id,
    today,
    nickname: () => "",
  });
  return {
    id: row.id,
    title: dto.title,
    doneCount: dto.doneCount,
    totalCount: dto.totalCount,
    targetDay: row.targetDay,
    daysLeft: row.targetDay ? daysUntilGoal(row.targetDay, today) : null,
  };
}

export async function createGoalAction(input: {
  title: string;
  note?: string;
  targetDay?: string | null;
  steps?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { ctx, partner } = await loadCtx();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }
  // P3-T11 边界：同时进行的目标最多 5 个
  const activeCount = await prisma.goal.count({
    where: { spaceId: ctx.membership.spaceId, status: "open" },
  });
  if (activeCount >= GOAL_ACTIVE_MAX) {
    return {
      ok: false,
      error: `最多同时进行 ${GOAL_ACTIVE_MAX} 个目标——先完成一个再立一个新的`,
    };
  }
  const today = shanghaiDay();
  if (parsed.data.targetDay && parsed.data.targetDay < today) {
    return { ok: false, error: "目标日不能早于今天" };
  }

  // 步骤随创建一起落（≤ 20 条）
  const stepTitles = (input.steps ?? [])
    .map((s) => goalStepSchema.safeParse({ title: s }))
    .filter((r) => r.success)
    .slice(0, GOAL_STEP_MAX)
    .map((r) => r.data!.title);

  await prisma.goal.create({
    data: {
      spaceId: ctx.membership.spaceId,
      creatorId: ctx.user.id,
      title: parsed.data.title,
      note: parsed.data.note || null,
      targetDay: parsed.data.targetDay || null,
      steps: {
        create: stepTitles.map((title, i) => ({ title, sortOrder: i })),
      },
    },
  });

  // V3-N：对方知道有新目标在推进
  pushToPartner(
    partner?.userId,
    ctx.user.id,
    {
      title: "新目标",
      body: `${ctx.membership.nickname} 立了个新目标「${parsed.data.title}」`,
      url: "/us/goals",
      tag: "goal",
    },
  );
  sendEventEmail(
    partner?.userId,
    ctx.user.id,
    ctx.membership.nickname,
    "goal",
  );
  revalidateGoals();
  return { ok: true };
}

export async function updateGoalAction(input: {
  id: string;
  title: string;
  note?: string;
  targetDay?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { ctx } = await loadCtx();
  const existing = await prisma.goal.findFirst({
    where: { id: input.id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "目标不存在" };
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }
  const today = shanghaiDay();
  if (parsed.data.targetDay && parsed.data.targetDay < today) {
    return { ok: false, error: "目标日不能早于今天" };
  }
  await prisma.goal.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title,
      note: parsed.data.note || null,
      targetDay: parsed.data.targetDay || null,
    },
  });
  revalidateGoals();
  return { ok: true };
}

/** P3-T11 边界：硬删，不进回收站（目标未开始无内容可挽回） */
export async function deleteGoalAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { ctx } = await loadCtx();
  const existing = await prisma.goal.findFirst({
    where: { id, spaceId: ctx.membership.spaceId },
  });
  if (!existing) return { ok: false, error: "目标不存在" };
  await prisma.goal.delete({ where: { id: existing.id } });
  revalidateGoals();
  return { ok: true };
}

export async function addStepAction(input: {
  goalId: string;
  title: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { ctx } = await loadCtx();
  const parsed = goalStepSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "参数无效" };
  }
  const goal = await prisma.goal.findFirst({
    where: {
      id: input.goalId,
      spaceId: ctx.membership.spaceId,
      status: "open",
    },
    include: { _count: { select: { steps: true } } },
  });
  if (!goal) return { ok: false, error: "目标不存在或已完成" };
  if (goal._count.steps >= GOAL_STEP_MAX) {
    return { ok: false, error: `每个目标最多 ${GOAL_STEP_MAX} 个步骤` };
  }
  await prisma.goalStep.create({
    data: {
      goalId: goal.id,
      title: parsed.data.title,
      sortOrder: goal._count.steps,
    },
  });
  revalidateGoals();
  return { ok: true };
}

export async function deleteStepAction(
  stepId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { ctx } = await loadCtx();
  const step = await prisma.goalStep.findFirst({
    where: { id: stepId, goal: { spaceId: ctx.membership.spaceId } },
  });
  if (!step) return { ok: false, error: "步骤不存在" };
  await prisma.goalStep.delete({ where: { id: stepId } });

  // 若目标已 done 而删步骤导致缺口，重新评估是否退回 open（共同财产可改）
  const goal = await prisma.goal.findFirst({
    where: { id: step.goalId },
    include: { steps: true },
  });
  if (goal && goal.status === "done" && goal.steps.some((s) => !s.doneById)) {
    await prisma.goal.update({
      where: { id: goal.id },
      data: { status: "open", completedAt: null },
    });
  }
  revalidateGoals();
  return { ok: true };
}

/** P3-T11：步骤双方各自可勾——勾选记录谁完成的（双人双色）；全勾自动转 done */
export async function toggleStepAction(
  stepId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { ctx, partner } = await loadCtx();
  const step = await prisma.goalStep.findFirst({
    where: { id: stepId, goal: { spaceId: ctx.membership.spaceId } },
    include: { goal: { include: { steps: true } } },
  });
  if (!step) return { ok: false, error: "步骤不存在" };
  if (step.goal.status === "done") {
    return { ok: false, error: "目标已达成；到归档里看吧" };
  }

  const newlyDone = step.doneById == null;
  await prisma.goalStep.update({
    where: { id: stepId },
    data: {
      doneById: newlyDone ? ctx.user.id : null,
      doneAt: newlyDone ? new Date() : null,
    },
  });

  // 通知对方（fire-and-forget）
  pushToPartner(
    partner?.userId,
    ctx.user.id,
    newlyDone
      ? pushGoalStepDone(ctx.membership.nickname, step.title)
      : {
          title: "目标进展",
          body: `${ctx.membership.nickname} 撤销了「${step.title}」`,
          url: "/us/goals",
          tag: "goal",
        },
  );

  // 全部步骤完成 → 原子转 done + 庆祝通知
  if (newlyDone) {
    const allDone = step.goal.steps.every(
      (s) => s.id === stepId || s.doneById != null,
    );
    if (allDone) {
      await prisma.goal.update({
        where: { id: step.goalId },
        data: { status: "done", completedAt: new Date() },
      });
      pushToPartner(
        partner?.userId,
        ctx.user.id,
        pushGoalCompleted(step.goal.title),
      );
      sendEventEmail(
        partner?.userId,
        ctx.user.id,
        ctx.membership.nickname,
        "goal",
      );
    }
  }

  revalidateGoals();
  return { ok: true };
}

/** 归档时间线用：把已达成目标并回日记特殊行（P1-1 模式） */
export async function loadGoalArchivedDays(): Promise<
  Array<{ day: string; title: string }>
> {
  const { ctx } = await loadCtx();
  const rows = await prisma.goal.findMany({
    where: { spaceId: ctx.membership.spaceId, status: "done" },
    select: { title: true, completedAt: true },
    orderBy: { completedAt: "desc" },
  });
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  return rows
    .filter((r): r is { title: string; completedAt: Date } =>
      Boolean(r.completedAt),
    )
    .map((r) => ({ day: fmt(r.completedAt), title: r.title }));
}
