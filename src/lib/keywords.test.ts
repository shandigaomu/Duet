import { describe, expect, it } from "vitest";
import { topKeywords } from "./keywords";

describe("topKeywords", () => {
  it("中文按 2-gram 切分并计频", () => {
    const out = topKeywords(["一起去东京", "东京的樱花", "东京塔下"], 5);
    const tokyo = out.find((k) => k.text === "东京");
    expect(tokyo?.count).toBe(3);
  });

  it("过滤停用词与单字虚词", () => {
    const out = topKeywords(["我的天空", "我们的一个"], 10);
    // 泛用词不进入关键词
    expect(
      out.some((k) => ["我", "的", "我们", "一个", "今天"].includes(k.text)),
    ).toBe(false);
  });

  it("频次排序：相同频次按首次出现先后稳定排序", () => {
    const out = topKeywords(["海洋", "沙滩", "海洋"], 10);
    expect(out[0]).toMatchObject({ text: "海洋", count: 2 });
    expect(out.map((k) => k.text)).not.toContain("沙滩海洋"); // 不跨界拼接
  });

  it("ASCII 按词计频并小写归一", () => {
    const out = topKeywords(["Run with Runaway", "RUN again"], 10);
    expect(out.find((k) => k.text === "run")?.count).toBeGreaterThanOrEqual(2);
  });

  it("超出 top N 截断", () => {
    const out = topKeywords(
      ["西湖边的傍晚", "餐厅里的晚餐", "散步到湖心岛", "咖啡馆的午后", "地铁站的音乐", "书店的角落"],
      5,
    );
    expect(out.length).toBe(5);
  });

  it("空输入返回空数组", () => {
    expect(topKeywords([], 5)).toEqual([]);
    expect(topKeywords(["", "   "], 5)).toEqual([]);
  });
});
