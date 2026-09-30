import { describe, expect, it } from "vitest";
import {
  aggregateWeeklyMood,
  recentWeekStarts,
  streakBadge,
  weeklyMoodSummary,
  type WeeklyMoodRow,
} from "@/lib/checkin";

describe("recentWeekStarts", () => {
  it("返回 n 个从旧到新的周一", () => {
    const starts = recentWeekStarts("2026-03-23", 4);
    expect(starts).toEqual([
      "2026-03-02",
      "2026-03-09",
      "2026-03-16",
      "2026-03-23",
    ]);
  });

  it("跨年回退正确", () => {
    const starts = recentWeekStarts("2026-01-05", 3);
    expect(starts).toEqual(["2025-12-22", "2025-12-29", "2026-01-05"]);
  });

  it("默认 8 周", () => {
    expect(recentWeekStarts("2026-03-23")).toHaveLength(8);
  });
});

describe("aggregateWeeklyMood", () => {
  const weekStart = "2026-03-23"; // 周一

  it("按周与作者侧聚合心情", () => {
    const rows: WeeklyMoodRow[] = [
      { day: "2026-03-23", authorIsMe: true, mood: "happy" },
      { day: "2026-03-24", authorIsMe: true, mood: "sad" },
      { day: "2026-03-23", authorIsMe: false, mood: "happy" },
      { day: "2026-03-17", authorIsMe: false, mood: "ok" }, // 上一周
      { day: "2026-03-09", authorIsMe: true, mood: null }, // 两周前，未选心情
    ];
    const weeks = aggregateWeeklyMood(rows, weekStart, 3);
    expect(weeks).toHaveLength(3);
    expect(weeks[2]!.me).toEqual({ happy: 1, ok: 0, sad: 1, days: 2 });
    expect(weeks[2]!.you).toEqual({ happy: 1, ok: 0, sad: 0, days: 1 });
    expect(weeks[1]!.you).toEqual({ happy: 0, ok: 1, sad: 0, days: 1 });
    expect(weeks[0]!.me).toEqual({ happy: 0, ok: 0, sad: 0, days: 1 });
  });

  it("窗口外的行被忽略", () => {
    const rows: WeeklyMoodRow[] = [
      { day: "2026-03-02", authorIsMe: true, mood: "happy" }, // 4 周前
      { day: "2026-03-30", authorIsMe: true, mood: "happy" }, // 下周
    ];
    const weeks = aggregateWeeklyMood(rows, weekStart, 3);
    expect(weeks.every((w) => w.me.days === 0)).toBe(true);
  });

  it("空数据返回全零周", () => {
    const weeks = aggregateWeeklyMood([], weekStart, 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[1]!.me.days).toBe(0);
    expect(weeks[1]!.you.days).toBe(0);
  });
});

describe("weeklyMoodSummary", () => {
  it("本周共同天数与连续周数", () => {
    const weeks = aggregateWeeklyMood(
      [
        { day: "2026-03-23", authorIsMe: true, mood: "happy" },
        { day: "2026-03-23", authorIsMe: false, mood: "ok" },
        { day: "2026-03-24", authorIsMe: true, mood: "happy" },
        { day: "2026-03-24", authorIsMe: false, mood: "sad" },
        // 上一周：只有我写了 → 打断连续
        { day: "2026-03-17", authorIsMe: true, mood: "ok" },
      ],
      "2026-03-23",
      3,
    );
    const s = weeklyMoodSummary(weeks);
    expect(s.togetherDaysThisWeek).toBe(2);
    expect(s.togetherWeeksStreak).toBe(1);
  });

  it("本周只有一方写 → 共同 0 天，连续 0 周", () => {
    const weeks = aggregateWeeklyMood(
      [
        { day: "2026-03-23", authorIsMe: true, mood: "happy" },
      ],
      "2026-03-23",
      2,
    );
    const s = weeklyMoodSummary(weeks);
    expect(s.togetherDaysThisWeek).toBe(0);
    expect(s.togetherWeeksStreak).toBe(0);
  });
});

// —— P3-T10 连续共同记录徽章 ——

function weekDays(start: string, count: number, side: "me" | "you" | "both") {
  const [y, m, d] = start.split("-").map(Number);
  const out: Array<{ day: string; authorIsMe: boolean }> = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(y!, m! - 1, d! + i));
    const day = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    if (side === "me" || side === "both") out.push({ day, authorIsMe: true });
    if (side === "you" || side === "both") out.push({ day, authorIsMe: false });
  }
  return out;
}

const THIS_MONDAY = recentWeekStarts("2026-09-28", 1)[0]!; // 2026-09-28 是周一

describe("streakBadge", () => {
  it("本周共同 ≥ 5 天 → 档一徽章", () => {
    const days = [...weekDays(THIS_MONDAY, 5, "both")];
    const b = streakBadge({ days, thisWeekStart: THIS_MONDAY });
    expect(b?.kind).toBe("week-days");
    expect(b?.kind === "week-days" && b.line).toContain("5 天");
  });

  it("本周只有我写 → 无徽章（对方天数不算共同）", () => {
    const b = streakBadge({
      days: weekDays(THIS_MONDAY, 7, "me"),
      thisWeekStart: THIS_MONDAY,
    });
    expect(b).toBeNull();
  });

  it("连续 4 周共同 → 档二徽章", () => {
    const starts = recentWeekStarts(THIS_MONDAY, 4);
    const days = starts.flatMap((s) => weekDays(s, 2, "both"));
    const b = streakBadge({ days, thisWeekStart: THIS_MONDAY });
    expect(b?.kind).toBe("weeks-streak");
    expect(b?.kind === "weeks-streak" && b.weeks).toBe(4);
  });

  it("中间断一周 → 连续被打断，无徽章", () => {
    const starts = recentWeekStarts(THIS_MONDAY, 4);
    const days = [
      ...weekDays(starts[0]!, 2, "both"),
      ...weekDays(starts[1]!, 2, "both"),
      // starts[2] 断
      ...weekDays(starts[3]!, 2, "both"),
    ];
    expect(streakBadge({ days, thisWeekStart: THIS_MONDAY })).toBeNull();
  });

  it("本周共 3 天不足档一但连续 5 周 → 落到档二", () => {
    const starts = recentWeekStarts(THIS_MONDAY, 5);
    const days = starts.flatMap((s) => weekDays(s, 3, "both"));
    const b = streakBadge({ days, thisWeekStart: THIS_MONDAY });
    expect(b?.kind).toBe("weeks-streak");
  });

  it("空数据 → null（安静消失）", () => {
    expect(streakBadge({ days: [], thisWeekStart: THIS_MONDAY })).toBeNull();
  });
});
