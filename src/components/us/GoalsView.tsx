"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, Target, Trash2, X } from "lucide-react";
import { Workbench } from "@/components/shell/Workbench";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  GOAL_STEP_MAX,
  dayLeftLine,
  type GoalDTO,
} from "@/lib/goal";
import {
  addStepAction,
  createGoalAction,
  deleteGoalAction,
  deleteStepAction,
  toggleStepAction,
  updateGoalAction,
} from "@/server/goal-actions";
import { formatDayShort } from "@/lib/journal";

type GoalsViewProps = {
  today: string;
  goals: GoalDTO[];
  partnerNickname: string;
};

export function GoalsView({ today, goals, partnerNickname }: GoalsViewProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GoalDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = goals.filter((g) => g.status === "open");
  const done = goals.filter((g) => g.status === "done");

  function submitSheet(input: {
    title: string;
    note: string;
    targetDay: string | null;
    steps: string[];
  }) {
    setError(null);
    startTransition(async () => {
      const res = editing
        ? await updateGoalAction({
            id: editing.id,
            title: input.title,
            note: input.note,
            targetDay: input.targetDay,
          })
        : await createGoalAction(input);
      if (!res.ok) {
        setError(res.error || "保存失败");
        return;
      }
      setSheetOpen(false);
      setEditing(null);
      router.refresh();
    });
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error || "操作失败");
      else router.refresh();
    });
  }

  function toggle(stepId: string) {
    act(() => toggleStepAction(stepId));
  }

  function removeGoal(goal: GoalDTO) {
    if (
      !window.confirm(
        goal.status === "done"
          ? "删除这条已达成的目标记录？"
          : `删除目标「${goal.title}」？删除后不可恢复`,
      )
    )
      return;
    act(() => deleteGoalAction(goal.id));
  }

  return (
    <>
      <Workbench
        eyebrow="Us · Goals"
        title="目标"
        description="正在一起推进的事——不是想做什么，是正在做。"
        action={
          <Button
            className="h-10 px-4"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            立一个目标
          </Button>
        }
      >
        {error ? (
          <p className="mb-3 text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {goals.length === 0 ? (
          <div className="glass-panel flex flex-col items-center gap-3 p-10 text-center">
            <Target className="size-6 text-brand" strokeWidth={1.5} />
            <p className="font-display text-[18px] text-ink-secondary">
              还没有一起定下的目标
            </p>
            <p className="max-w-[340px] text-[13px] text-ink-tertiary">
              存钱去旅行、一起跑完 3 公里、去 5 座城市——把「想要」变成「正在做」。
            </p>
          </div>
        ) : null}

        {active.length > 0 ? (
          <section className="space-y-4">
            <h2 className="font-display text-[20px] text-ink-secondary">进行中</h2>
            {active.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                partnerNickname={partnerNickname}
                onToggle={toggle}
                onDeleteStep={(stepId) => {
                  if (window.confirm("删除这个步骤？")) {
                    act(() => deleteStepAction(stepId));
                  }
                }}
                onAddStep={(title) =>
                  act(() => addStepAction({ goalId: g.id, title }))
                }
                onEdit={() => {
                  setEditing(g);
                  setSheetOpen(true);
                }}
                onDelete={() => removeGoal(g)}
                pending={pending}
              />
            ))}
          </section>
        ) : null}

        {done.length > 0 ? (
          <section className="mt-8 space-y-4">
            <h2 className="font-display text-[20px] text-ink-secondary">已达成</h2>
            {done.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                partnerNickname={partnerNickname}
                onDelete={() => removeGoal(g)}
                pending={pending}
              />
            ))}
          </section>
        ) : null}
      </Workbench>

      {sheetOpen ? (
        <GoalSheet
          editing={editing}
          today={today}
          pending={pending}
          onClose={() => {
            setSheetOpen(false);
            setEditing(null);
          }}
          onSubmit={submitSheet}
        />
      ) : null}
    </>
  );
}

function GoalCard({
  goal,
  partnerNickname,
  onToggle,
  onDeleteStep,
  onAddStep,
  onEdit,
  onDelete,
  pending,
}: {
  goal: GoalDTO;
  partnerNickname: string;
  onToggle?: (stepId: string) => void;
  onDeleteStep?: (stepId: string) => void;
  onAddStep?: (title: string) => void;
  onEdit?: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const isDone = goal.status === "done";
  return (
    <div
      className={cn(
        "glass-panel p-5",
        isDone &&
          "border-2 border-[var(--signal)] shadow-[0_0_0_1px_var(--signal)]",
        goal.nearlyDone && !isDone && "border-brand/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-ink">
            {isDone ? "🎉 一起完成了 " : ""}
            {goal.title}
          </p>
          <p className="mt-1 text-[12px] text-ink-tertiary">
            {goal.totalCount > 0 ? `${goal.doneCount}/${goal.totalCount} 步` : "还没有拆步骤"}
            {goal.targetDay && !isDone
              ? ` · 目标日 ${formatDayShort(goal.targetDay)}${
                  goal.daysLeft != null
                    ? dayLeftLine(goal.daysLeft, " · ")
                    : ""
                }`
              : null}
            {goal.nearlyDone ? " · 只差最后 1 步" : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="text-[12px] font-medium text-brand"
            >
              编辑
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded p-1.5 text-ink-tertiary hover:text-danger"
            aria-label="删除目标"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      {goal.note ? (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
          {goal.note}
        </p>
      ) : null}

      <ul className="mt-3 space-y-1.5">
        {goal.steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle && !pending ? () => onToggle(s.id) : undefined}
              disabled={isDone || pending || !onToggle}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                s.doneById
                  ? s.doneByMe
                    ? "border-me bg-me text-white"
                    : "border-you bg-you text-white"
                  : "border-line bg-transparent hover:border-brand",
              )}
              aria-label={s.doneById ? `已完成（${s.doneNickname} 勾的）` : "标记完成"}
            >
              {s.doneById ? (
                <Check className="size-3" strokeWidth={2.5} />
              ) : null}
            </button>
            <span
              className={cn(
                "flex-1 text-[14px]",
                s.doneById ? "text-ink-tertiary line-through" : "text-ink",
              )}
            >
              {s.title}
              {s.doneById ? (
                <span className={cn("ml-1.5 text-[11px]", s.doneByMe ? "text-me" : "text-you")}>
                  · {s.doneByMe ? "我" : partnerNickname}
                </span>
              ) : null}
            </span>
            {onDeleteStep && !isDone ? (
              <button
                type="button"
                onClick={() => onDeleteStep(s.id)}
                disabled={pending}
                className="text-[11px] text-ink-tertiary hover:text-danger"
                aria-label="删除步骤"
              >
                删
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {onAddStep && !isDone ? <AddStepRow onAdd={onAddStep} pending={pending} /> : null}
    </div>
  );
}

function AddStepRow({
  onAdd,
  pending,
}: {
  onAdd: (title: string) => void;
  pending: boolean;
}) {
  const [value, setValue] = useState("");
  const canAdd = value.trim().length > 0;

  function submit() {
    if (!canAdd || pending) return;
    onAdd(value.trim());
    setValue("");
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="加一步…"
        className="h-9 flex-1 rounded-[10px] border border-line bg-white/45 px-3 text-[13px] outline-none focus:border-brand"
      />
      <Button variant="ghost" className="h-9 px-2" onClick={submit} disabled={!canAdd || pending}>
        <Plus className="size-4" strokeWidth={1.75} />
      </Button>
    </div>
  );
}

function GoalSheet({
  editing,
  today,
  pending,
  onClose,
  onSubmit,
}: {
  editing: GoalDTO | null;
  today: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    note: string;
    targetDay: string | null;
    steps: string[];
  }) => void;
}) {
  // 仅在打开时挂载（父层条件渲染），直接用初始 props，避免 effect 回写
  const [title, setTitle] = useState(editing?.title ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [targetDay, setTargetDay] = useState(editing?.targetDay ?? "");
  const [stepsText, setStepsText] = useState(
    editing ? editing.steps.map((s) => s.title).join("\n") : "",
  );

  const titleId = useId();

  const stepLines = stepsText
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, GOAL_STEP_MAX);

  function submit() {
    onSubmit({
      title,
      note,
      targetDay: targetDay || null,
      steps: stepLines,
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        className="sheet-overlay absolute inset-0 bg-[rgba(18,21,26,0.18)] backdrop-blur-md"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-panel glass-sheet relative z-10 w-full max-w-[440px] rounded-t-[28px] p-5 md:rounded-[28px] md:p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--accent)] uppercase">
              Goal
            </p>
            <h2 id={titleId} className="mt-1 font-display text-[19px] text-ink">
              {editing ? "编辑目标" : "立一个目标"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-ink-secondary hover:bg-white/45"
            aria-label="关闭"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="比如：一起去 5 座城市"
          className="mt-4 w-full rounded-[14px] border border-line bg-white/45 px-3 py-2.5 text-[14px] outline-none focus:border-brand"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="补充说明（可选）"
          className="mt-2 w-full resize-none rounded-[14px] border border-line bg-white/45 px-3 py-2.5 text-[14px] outline-none focus:border-brand"
        />
        <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-secondary">
          目标日
          <input
            type="date"
            min={today}
            value={targetDay}
            onChange={(e) => setTargetDay(e.target.value)}
            className="h-9 flex-1 rounded-[10px] border border-line bg-white/45 px-3 text-[13px] outline-none focus:border-brand"
          />
        </label>
        {!editing ? (
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={4}
            placeholder={`拆几步？每行一步（可选，最多 ${GOAL_STEP_MAX} 步）`}
            className="mt-2 w-full resize-none rounded-[14px] border border-line bg-white/45 px-3 py-2.5 text-[14px] outline-none focus:border-brand"
          />
        ) : (
          <p className="mt-2 text-[12px] text-ink-tertiary">
            步骤在卡片里增删勾选——双方都可以改。
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" className="h-9 px-3" onClick={onClose}>
            取消
          </Button>
          <Button
            className="h-9 px-4"
            onClick={submit}
            disabled={pending || !title.trim()}
          >
            {pending ? "保存中…" : editing ? "保存" : "立下目标"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
