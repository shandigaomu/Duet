import { NextResponse } from "next/server";
import {
  contentTypeFromKey,
  readLocalObject,
} from "@/lib/storage";

type Ctx = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 若配置了 S3 公网域名，文件应直链访问；此路由主要用于本地驱动
  const bytes = await readLocalObject(key);
  if (!bytes) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentTypeFromKey(key),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
