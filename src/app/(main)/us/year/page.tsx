import { YearView } from "@/components/us/YearView";
import { loadYearInReview } from "@/server/year-actions";
import { partnerOf } from "@/lib/entry-shared";
import { requirePaired } from "@/lib/guards";

export const metadata = { title: "年度回顾" };

export default async function YearPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[] }>;
}) {
  const sp = await searchParams;
  const year = Array.isArray(sp.year) ? sp.year[0] : sp.year;
  const [data, ctx] = await Promise.all([
    loadYearInReview({ year }),
    requirePaired(),
  ]);
  const partner = partnerOf(ctx);

  return <YearView data={data} partnerNickname={partner?.nickname ?? "你"} />;
}
