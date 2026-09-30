const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.82;
/** 已小于该体积的图不再重编码 */
const SKIP_BELOW = 1.5 * 1024 * 1024;

/**
 * 选图后先压缩再上传（P0-0）：长边 ≤ 2048px，JPEG q=0.82。
 * GIF 跳过（会丢动画）；PNG 保留 PNG；压缩结果反而更大时用原图。
 * 任何一步失败都回退原图，绝不阻塞上传。
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (file.type === "image/gif") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= SKIP_BELOW) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const ext = type === "image/png" ? ".png" : ".jpg";
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}${ext}`, { type });
  } catch {
    return file;
  }
}
