import { describe, expect, it } from "vitest";
import {
  addDay,
  dayBeforeNotifyTarget,
  letterState,
  toLetterDTO,
} from "@/lib/letter";

describe("addDay", () => {
  it("普通 +1 天", () => {
    expect(addDay("2026-10-13")).toBe("2026-10-14");
  });

  it("跨月与跨年正确", () => {
    expect(addDay("2026-10-31")).toBe("2026-11-01");
    expect(addDay("2026-12-31")).toBe("2027-01-01");
  });
});

describe("dayBeforeNotifyTarget", () => {
  const today = "2026-10-13";

  it("解锁日是明天且写信方在访 → 推给收信方", () => {
    expect(
      dayBeforeNotifyTarget({
        unlockDay: "2026-10-14",
        today,
        authorId: "a",
        viewerId: "a",
        partnerId: "b",
      }),
    ).toBe("b");
  });

  it("不是明天 → null", () => {
    expect(
      dayBeforeNotifyTarget({
        unlockDay: "2026-10-15",
        today,
        authorId: "a",
        viewerId: "a",
        partnerId: "b",
      }),
    ).toBeNull();
  });

  it("收信方本人打开信页 → 不推（人已在场）", () => {
    expect(
      dayBeforeNotifyTarget({
        unlockDay: "2026-10-14",
        today,
        authorId: "a",
        viewerId: "b",
        partnerId: "a",
      }),
    ).toBeNull();
  });

  it("无对方（未配对空间）→ null", () => {
    expect(
      dayBeforeNotifyTarget({
        unlockDay: "2026-10-14",
        today,
        authorId: "a",
        viewerId: "a",
        partnerId: null,
      }),
    ).toBeNull();
  });
});

describe("letterState / toLetterDTO 破坏性重构防线", () => {
  it("sealed/unlocking/opened 三态不变", () => {
    expect(letterState("2026-10-14", "2026-10-13")).toBe("sealed");
    expect(letterState("2026-10-13", "2026-10-13")).toBe("unlocking");
    expect(letterState("2026-10-12", "2026-10-13")).toBe("opened");
  });

  it("收信方在 sealed 态拿不到正文（红线回归）", () => {
    const dto = toLetterDTO(
      {
        id: "1",
        title: "标题",
        body: "正文",
        imageUrl: null,
        unlockDay: "2026-10-14",
        authorId: "a",
        createdAt: new Date(),
      },
      { viewerId: "b", today: "2026-10-13" },
    );
    expect(dto.body).toBeNull();
    expect(dto.title).toBe("标题"); // 收信方看得到标题（列表封面）；正文不可见
  });
});
