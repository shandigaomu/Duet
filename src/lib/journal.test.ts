import { describe, expect, it } from "vitest";
import {
  formatDayShort,
  formatMonthHeading,
  previewBody,
  shanghaiMonth,
  shanghaiWeekRange,
} from "@/lib/journal";

/** UTC 正午 → 上海同为该自然日，避免时区边界抖动 */
function utcNoon(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

describe("shanghaiWeekRange", () => {
  it("周一为一周起始", () => {
    // 2026-03-24 是周二 → 本周 03-23（周一）～ 03-29（周日）
    expect(shanghaiWeekRange(utcNoon(2026, 3, 24))).toEqual({
      start: "2026-03-23",
      end: "2026-03-29",
    });
  });

  it("周日当天仍归本周", () => {
    expect(shanghaiWeekRange(utcNoon(2026, 3, 29))).toEqual({
      start: "2026-03-23",
      end: "2026-03-29",
    });
  });

  it("周一当天开启新一周", () => {
    expect(shanghaiWeekRange(utcNoon(2026, 3, 23))).toEqual({
      start: "2026-03-23",
      end: "2026-03-29",
    });
  });

  it("跨年周", () => {
    // 2026-01-01 是周四 → 本周 2025-12-29 ～ 2026-01-04
    expect(shanghaiWeekRange(utcNoon(2026, 1, 1))).toEqual({
      start: "2025-12-29",
      end: "2026-01-04",
    });
  });
});

describe("shanghaiMonth", () => {
  it("返回 YYYY-MM", () => {
    expect(shanghaiMonth(utcNoon(2026, 3, 24))).toBe("2026-03");
  });

  it("跨年边界按上海日取月", () => {
    // UTC 2025-12-31 16:30 = 上海 2026-01-01 00:30
    expect(shanghaiMonth(new Date("2025-12-31T16:30:00Z"))).toBe("2026-01");
  });
});

describe("previewBody", () => {
  it("短文本原样、压缩空白", () => {
    expect(previewBody("今天很累。")).toBe("今天很累。");
    expect(previewBody("a\n  b\tc")).toBe("a b c");
  });

  it("超长截断加省略号", () => {
    expect(previewBody("x".repeat(80), 72)).toBe("x".repeat(72) + "…");
    expect(previewBody("x".repeat(72), 72)).toBe("x".repeat(72));
  });
});

describe("日期格式化", () => {
  it("formatDayShort 去前导零", () => {
    expect(formatDayShort("2026-03-08")).toBe("3.8");
    expect(formatDayShort("2026-12-31")).toBe("12.31");
  });

  it("formatMonthHeading", () => {
    expect(formatMonthHeading("2026-03-01")).toBe("3月");
  });
});
