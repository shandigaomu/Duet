import { describe, expect, it } from "vitest";
import { dayLeftLine, daysUntilGoal } from "@/lib/goal";

describe("daysUntilGoal", () => {
  it("未来为正、今天为 0、过去为负", () => {
    expect(daysUntilGoal("2026-10-15", "2026-10-14")).toBe(1);
    expect(daysUntilGoal("2026-10-14", "2026-10-14")).toBe(0);
    expect(daysUntilGoal("2026-10-01", "2026-10-14")).toBe(-13);
  });
});

describe("dayLeftLine（P5-O6 文案单一实现）", () => {
  it("还剩 N 天 / 就是今天 / 目标日已过 N 天", () => {
    expect(dayLeftLine(3)).toBe("还剩 3 天");
    expect(dayLeftLine(0)).toBe("就是今天");
    expect(dayLeftLine(-2)).toBe("目标日已过 2 天");
  });

  it("前缀透传", () => {
    expect(dayLeftLine(5, " · ")).toBe(" · 还剩 5 天");
  });
});
