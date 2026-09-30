import { NextResponse } from "next/server";
import { loadTimeline } from "@/server/entry-actions";
import type { TimelineFilter } from "@/lib/journal";

export const dynamic = "force-dynamic";

function parseFilter(raw?: string): TimelineFilter {
  if (
    raw === "mine" ||
    raw === "yours" ||
    raw === "week" ||
    raw === "thisMonth" ||
    raw === "month"
  ) {
    return raw;
  }
  return "all";
}

/** 时间线分页拉取（P0-0）：与 /journal 首屏同源同序 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filter = parseFilter(url.searchParams.get("filter") ?? undefined);
  const month = url.searchParams.get("month") ?? undefined;
  const q = url.searchParams.get("q") ?? "";
  const cursor = url.searchParams.get("cursor") ?? undefined;

  try {
    const data = await loadTimeline({ filter, month, q, cursor });
    return NextResponse.json({
      ok: true,
      items: data.items,
      nextCursor: data.nextCursor,
      onThisDay: data.onThisDay,
    });
  } catch (e) {
    // 未登录时 requirePaired 抛 NEXT_REDIRECT，交回框架处理（307 → /login）
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
