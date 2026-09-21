import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  assertImageMeta,
  putImageObject,
  type UploadKind,
  UPLOAD_MAX_BYTES,
} from "@/lib/storage";

const KINDS = new Set<UploadKind>(["avatar", "checkin", "entry"]);

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  }

  const membership = await prisma.spaceMember.findUnique({
    where: { userId: session.user.id },
  });
  if (!membership) {
    return NextResponse.json(
      { ok: false, error: "请先创建或加入空间" },
      { status: 403 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "无效请求" }, { status: 400 });
  }

  const kindRaw = String(form.get("kind") || "");
  if (!KINDS.has(kindRaw as UploadKind)) {
    return NextResponse.json({ ok: false, error: "无效上传类型" }, { status: 400 });
  }
  const kind = kindRaw as UploadKind;

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "缺少文件" }, { status: 400 });
  }

  const metaErr = assertImageMeta(file.type, file.size);
  if (metaErr) {
    return NextResponse.json({ ok: false, error: metaErr }, { status: 400 });
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "图片过大" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const put = await putImageObject({
      kind,
      spaceId: membership.spaceId,
      userId: session.user.id,
      bytes,
      contentType: file.type || "image/jpeg",
    });
    return NextResponse.json({ ok: true, url: put.url, key: put.key });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
