import { z } from "zod";

export const YEAR_REVIEW_RE = /^20\d{2}$/;

/** T9 年度参数：年份校验（默认当年由调用方处理） */
export const yearSchema = z
  .string()
  .regex(YEAR_REVIEW_RE, "年份无效")
  .optional()
  .nullable();

/** P3-T9 停用词表：中文高频虚词 + 过泛词（两人体量 500 篇日记够用，不引分词库） */
const STOPWORDS = new Set([
  // 单字虚词 / 过泛
  "我", "你", "他", "她", "它", "的", "了", "是", "在", "和", "有", "就", "一",
  "不", "人", "都", "也", "这", "那", "们", "个", "上", "下", "中", "大", "小",
  "好", "很", "还", "又", "说", "要", "会", "去", "没", "吧", "吗", "呢", "啊",
  "哦", "嗯", "以", "为", "到", "把", "再", "才", "只", "更", "跟", "很", "但",
  "or", "and", "the", "a", "an", "is", "are", "was", "were", "to", "of", "in",
  // 双字过泛
  "今天", "明天", "昨天", "一个", "什么", "自己", "我们", "你们", "他们", "因为",
  "所以", "但是", "然后", "开始", "结束", "时候", "现在", "感觉", "觉得", "已经",
]);

/**
 * T9 关键词抽取：中文按 2-gram 切 + ASCII 按词，停用词过滤，频次排序稳定取前 N。
 * 同频次按出现先后排序（tie-break = 首次出现位置），避免每次刷新顺序抖动。
 */
export function topKeywords(
  titles: string[],
  n = 5,
): Array<{ text: string; count: number }> {
  const freq = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  let order = 0;

  function put(text: string) {
    if (text.length < 2 && !/^[a-zA-Z]{2,}$/.test(text)) return;
    if (STOPWORDS.has(text)) return;
    freq.set(text, (freq.get(text) ?? 0) + 1);
    if (!firstSeen.has(text)) firstSeen.set(text, order++);
  }

  for (const raw of titles) {
    const asciiWords = raw.match(/[a-zA-Z][a-zA-Z0-9'-]{1,}/g) ?? [];
    for (const w of asciiWords) {
      const word = w.toLowerCase();
      if (word.length >= 2) put(word);
    }
    // 去掉 ASCII 片段后，中文按 2-gram 滑窗（含重叠）
    const cjkText = raw.replace(/[a-zA-Z0-9'-]+/g, " ");
    for (const seg of cjkText.split(/\s+/)) {
      if (!seg) continue;
      const chars = Array.from(seg);
      if (chars.length === 1) {
        put(chars[0]!);
        continue;
      }
      for (let i = 0; i + 2 <= chars.length; i++) {
        put(chars.slice(i, i + 2).join(""));
      }
    }
  }

  return [...freq.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1] || firstSeen.get(a[0])! - firstSeen.get(b[0])!)
    .slice(0, n)
    .map(([text, count]) => ({ text, count }));
}
