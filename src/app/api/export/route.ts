import { NextResponse } from "next/server";
import { getPairingState, requireUser } from "@/lib/session";
import { createZip } from "@/lib/zip";
import {
  buildExportBundle,
  exportZipFileName,
} from "@/server/export-bundle";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** V3-F2：GET /api/export → 打包当前空间全部数据为 zip 附件下载 */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const pairing = await getPairingState(user.id);
  if (pairing.status !== "paired" || !pairing.membership) {
    return NextResponse.json({ error: "需完成配对" }, { status: 403 });
  }

  const bundle = await buildExportBundle(
    user.id,
    pairing.membership.spaceId,
  );
  const zip = createZip(bundle.files);

  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${exportZipFileName()}"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
    },
  });
}
