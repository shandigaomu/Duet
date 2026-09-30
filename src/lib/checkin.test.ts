import { describe, expect, it } from "vitest";
import {
  aggregateWeeklyMood,
  recentWeekStarts,
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
