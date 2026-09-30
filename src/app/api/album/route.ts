import { NextResponse } from "next/server";
import { loadAlbum } from "@/server/album-actions";

export const dynamic = "force-dynamic";

/** 相册分页拉取（P0-0）：与 /us/album 首屏同源同序 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sourceRaw = url.searchParams.get("source");
  const source =
    sourceRaw === "mine" || sourceRaw === "yours" ? sourceRaw : "all";
  const cursor = url.searchParams.get("cursor") ?? undefined;

  try {
    const data = await loadAlbum({ source, cursor });
    return NextResponse.json({
      ok: true,
      photos: data.photos,
      nextCursor: data.nextCursor,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
