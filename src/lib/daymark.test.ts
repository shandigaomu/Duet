import { describe, expect, it } from "vitest";
import {
  buildHint,
  buildMonthGrid,
  daysBetween,
  formatHintLabel,
  nextOccurrence,
  shiftMonth,
  splitUpcomingPast,
} from "@/lib/daymark";

describe("daysBetween", () => {
  it("同月内日历差", () => {
    expect(daysBetween("2026-03-24", "2026-03-28")).toBe(4);
    expect(daysBetween("2026-03-28", "2026-03-24")).toBe(-4);
  });

  it("跨月与跨年", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });
});

describe("nextOccurrence", () => {
  const today = "2026-03-24";

  it("非周年原样返回", () => {
    expect(nextOccurrence("2025-08-01", false, today)).toBe("2025-08-01");
  });

  it("周年：今年未过取今年", () => {
    expect(nextOccurrence("2020-03-28", true, today)).toBe("2026-03-28");
  });

  it("周年：今年已过取明年", () => {
    expect(nextOccurrence("2020-03-20", true, today)).toBe("2027-03-20");
  });

  it("周年：当天即今天", () => {
    expect(nextOccurrence("2020-03-24", true, today)).toBe("2026-03-24");
  });

  it("周年：2/29 在平年收敛到 2/28，闰年回到 2/29", () => {
    expect(nextOccurrence("2024-02-29", true, "2026-01-10")).toBe("2026-02-28");
    expect(nextOccurrence("2024-02-29", true, "2027-03-01")).toBe("2028-02-29");
  });
});

describe("buildHint / formatHintLabel", () => {
  const base = { id: "m1", title: "去看海", yearly: false };

  it("0 天 → 今天", () => {
    const hint = buildHint({ ...base, day: "2026-03-24" }, "2026-03-24");
    expect(hint?.label).toBe("今天 · 去看海");
    expect(hint?.daysUntil).toBe(0);
  });

  it("1 天 → 明天", () => {
    const hint = buildHint({ ...base, day: "2026-03-25" }, "2026-03-24");
    expect(hint?.label).toBe("明天 · 去看海");
  });

  it("2–6 天 → 周几", () => {
    // 2026-03-27 是周五
    const hint = buildHint({ ...base, day: "2026-03-27" }, "2026-03-24");
    expect(hint?.label).toBe("周五 · 去看海");
  });

  it("7 天仍在窗口内", () => {
    const hint = buildHint({ ...base, day: "2026-03-31" }, "2026-03-24");
    expect(hint).not.toBeNull();
    expect(hint?.label).toBe("还有 7 天 · 去看海");
  });

  it("超过窗口返回 null", () => {
    expect(buildHint({ ...base, day: "2026-04-01" }, "2026-03-24")).toBeNull();
    expect(buildHint({ ...base, day: "2026-03-23" }, "2026-03-24")).toBeNull();
  });

  it("周年按下一周年日计入窗口", () => {
    const hint = buildHint(
      { id: "m2", title: "在一起", yearly: true, day: "2020-03-28" },
      "2026-03-24",
    );
    expect(hint?.nextDay).toBe("2026-03-28");
    expect(hint?.label).toBe("周六 · 在一起");
  });

  it("formatHintLabel 各档位", () => {
    expect(formatHintLabel("x", "2026-03-24", 0)).toBe("今天 · x");
    expect(formatHintLabel("x", "2026-03-25", 1)).toBe("明天 · x");
    expect(formatHintLabel("x", "2026-03-27", 3)).toBe("周五 · x");
    expect(formatHintLabel("x", "2026-03-31", 7)).toBe("还有 7 天 · x");
  });
});

describe("buildMonthGrid", () => {
  it("周一起始，2026-03 首日（周日）补 6 格，尾部补满 7 的倍数", () => {
    const { cells } = buildMonthGrid("2026-03");
    expect(cells).toHaveLength(42);
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(cells[6]).toEqual({ day: "2026-03-01", inMonth: true });
    expect(cells[6 + 30]).toEqual({ day: "2026-03-31", inMonth: true });
    expect(cells[6 + 31]).toBeNull();
  });

  it("28 天月份补到最近的 7 倍数（5 行）", () => {
    // 2026-02：2/1 是周日 → 6 + 28 = 34 → 补到 35
    const { cells } = buildMonthGrid("2026-02");
    expect(cells).toHaveLength(35);
    expect(cells[6]).toEqual({ day: "2026-02-01", inMonth: true });
    expect(cells[6 + 27]).toEqual({ day: "2026-02-28", inMonth: true });
    expect(cells[34]).toBeNull();
  });
});

describe("shiftMonth", () => {
  it("普通平移与跨年", () => {
    expect(shiftMonth("2026-03", 1)).toBe("2026-04");
    expect(shiftMonth("2026-03", -1)).toBe("2026-02");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("splitUpcomingPast", () => {
  it("按 nextDay 与今天分列并排序", () => {
    const today = "2026-03-24";
    const { upcoming, past } = splitUpcomingPast(
      [
        { id: "a", nextDay: "2026-03-30" },
        { id: "b", nextDay: "2026-03-24" },
        { id: "c", nextDay: "2026-03-01" },
        { id: "d", nextDay: "2026-03-26" },
      ],
      today,
    );
    expect(upcoming.map((m) => m.id)).toEqual(["b", "d", "a"]);
    expect(past.map((m) => m.id)).toEqual(["c"]);
  });
});
