import type { UploadKind } from "@/lib/storage";

export async function uploadImageFile(
  file: File,
  kind: UploadKind,
): Promise<{ url: string }> {
  const body = new FormData();
  body.set("file", file);
  body.set("kind", kind);

  const res = await fetch("/api/upload", {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !data.ok || !data.url) {
    throw new Error(data.error || "上传失败");
  }
  return { url: data.url };
}

/** 将 blob:/data: 预览换成已上传 URL；已是 http(s) 的保留 */
export async function resolveImageUrls(
  items: Array<{ preview: string; file?: File | null }>,
  kind: UploadKind,
): Promise<string[]> {
  const out: string[] = [];
  for (const item of items) {
    if (item.file) {
      const { url } = await uploadImageFile(item.file, kind);
      out.push(url);
      continue;
    }
    if (
      item.preview.startsWith("http://") ||
      item.preview.startsWith("https://") ||
      item.preview.startsWith("/api/files/")
    ) {
      out.push(item.preview);
    }
  }
  return out;
}
