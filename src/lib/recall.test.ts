import { describe, expect, it } from "vitest";
import {
  daysBetweenDays,
  pickRecall,
  previewRecallBody,
  recallSeed,
  type RecallRow,
} from "@/lib/recall";

const ROWS: RecallRow[] = [
  { id: "e3", day: "2025-03-10", title: "海边", body: "风很大。" },
  { id: "e1", day: "2024-12-25", title: "平安夜", body: "一起吃了火锅。" },
  { id: "e2", day: "2025-06-01", title: null, body: "去爬山了，累但开心。" },
];

describe("recallSeed", () => {
  it("同输入种子稳定", () => {
    expect(recallSeed("space1", "2026-09-30")).toBe(
      recallSeed("space1", "2026-09-30"),
    );
  });

  it("不同空间或日期种子不同", () => {
    const a = recallSeed("space1", "2026-09-30");
    const b = recallSeed("space2", "2026-09-30");
    const c = recallSeed("space1", "2026-10-01");
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("pickRecall", () => {
  it("同天同空间两人生成相同选择（核心验收）", () => {
    const p1 = pickRecall(ROWS, "space1", "2026-09-30");
    const p2 = pickRecall(
      ROWS.slice().reverse(),
      "space1", // 传入顺序不同也应一致（稳定排序）
      "2026-09-30",
    );
    expect(p1).not.toBeNull();
    expect(p2!.entry.id).toBe(p1!.entry.id);
  });

  it("命中行在候选集内且年份差 ≥ 1", () => {
    const p = pickRecall(ROWS, "space1", "2026-09-30");
    expect(ROWS.some((r) => r.id === p!.entry.id)).toBe(true);
    expect(p!.yearsAgo).toBeGreaterThanOrEqual(1);
    expect(p!.poolSize).toBe(3);
  });

  it("跨天选择会变化（30 天样本至少出现两种结果）", () => {
    const picks = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const day = `2026-10-${String(1 + i).padStart(2, "0")}`;
      picks.add(pickRecall(ROWS, "space1", day)!.entry.id);
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it("空候选返回 null", () => {
    expect(pickRecall([], "space1", "2026-09-30")).toBeNull();
  });

  it("单候选必命中", () => {
    const p = pickRecall([ROWS[0]!], "space1", "2026-09-30");
    expect(p!.entry.id).toBe("e3");
    // 2025-03-10 → 2026 = 1 年
    expect(p!.yearsAgo).toBe(1);
  });
});

describe("previewRecallBody", () => {
  it("压缩空白", () => {
    expect(previewRecallBody("  好\n\n久  不见  ", 10)).toBe("好 久 不见");
  });

  it("超长截断加省略号", () => {
    const long = "一".repeat(80);
    const p = previewRecallBody(long, 64);
    expect(p.length).toBe(65);
    expect(p.endsWith("…")).toBe(true);
  });
});

describe("daysBetweenDays", () => {
  it("同日为 0，未来为正，跨月跨年正确", () => {
    expect(daysBetweenDays("2026-09-30", "2026-09-30")).toBe(0);
    expect(daysBetweenDays("2026-09-30", "2026-10-01")).toBe(1);
    expect(daysBetweenDays("2026-09-30", "2026-12-31")).toBe(92);
    expect(daysBetweenDays("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetweenDays("2026-10-01", "2026-09-30")).toBe(-1);
  });
});
