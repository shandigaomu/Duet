import { compressImage } from "@/lib/image-compress";
import type { UploadKind } from "@/lib/storage";

export async function uploadImageFile(
  file: File,
  kind: UploadKind,
  onProgress?: (pct: number) => void,
): Promise<{ url: string }> {
  // P0-0：上传前压缩（原图过大时显著省流量）；失败自动回退原图
  const prepared = kind === "avatar" ? file : await compressImage(file);
  const body = new FormData();
  body.set("file", prepared);
  body.set("kind", kind);

  // P1-4：需要进度回调时走 XHR（fetch 无上传进度）
  if (onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText) as {
            ok?: boolean;
            url?: string;
            error?: string;
          };
          if (xhr.status >= 200 && xhr.status < 300 && data.ok && data.url) {
            resolve({ url: data.url });
          } else {
            reject(new Error(data.error || "上传失败"));
          }
        } catch {
          reject(new Error("上传失败"));
        }
      };
      xhr.onerror = () => reject(new Error("网络错误，上传失败"));
      xhr.send(body);
    });
  }

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
