import { prisma } from "@/lib/db";
import { readLocalObject } from "@/lib/storage";
import { shanghaiDay } from "@/lib/space";

/**
 * V3-F2 数据导出：把空间内全部用户数据聚合成 zip 条目。
 * 图片统一读流（本地驱动读文件；COS 公网直链走 fetch），单张失败跳过不阻塞导出。
 */

export type BundleFile = { name: string; data: Uint8Array };

const IMAGE_FETCH_TIMEOUT_MS = 15_000;
/** 防御性上限：两人空间远达不到，防止异常数据拖垮导出 */
const MAX_EXPORT_IMAGES = 800;

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith("/api/files/")) {
      const key = decodeURIComponent(url.replace(/^\/api\/files\//, ""));
      const bytes = await readLocalObject(key);
      return bytes ? new Uint8Array(bytes) : null;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
    return null;
  } catch {
    return null;
  }
}

function jsonFile(name: string, exportedAt: string, items: unknown): BundleFile {
  const text = JSON.stringify({ exportedAt, items }, null, 2);
  return { name, data: new TextEncoder().encode(text) };
}

/** 收集图片 URL（去重、保序），entries 的多图 + 今日一图 + 时光信一图 */
function collectImageUrls(urls: Array<string | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (
      url &&
      (url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("/api/files/")) &&
      !seen.has(url)
    ) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

export async function buildExportBundle(
  viewerId: string,
  spaceId: string,
): Promise<{ files: BundleFile[]; imageTotal: number; imageFailed: number }> {
  const exportedAt = new Date().toISOString();

  const [entries, checkIns, dayMarks, listItems, notes, letters] =
    await Promise.all([
      prisma.entry.findMany({
        where: { spaceId },
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          reactions: true,
        },
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
      }),
      prisma.checkIn.findMany({
        where: { spaceId },
        orderBy: [{ day: "asc" }, { authorId: "asc" }],
      }),
      prisma.dayMark.findMany({
        where: { spaceId },
        orderBy: { day: "asc" },
      }),
      prisma.listItem.findMany({
        where: { spaceId },
        orderBy: [{ category: "asc" }, { createdAt: "asc" }],
      }),
      prisma.note.findMany({
        where: { spaceId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.letter.findMany({
        where: { spaceId },
        orderBy: { unlockDay: "asc" },
      }),
    ]);

  const files: BundleFile[] = [
    jsonFile(
      "entries.json",
      exportedAt,
      // 私密日记仅作者本人可导出（导出人视角过滤）
      entries
        .filter((e) => e.visibility !== "private" || e.authorId === viewerId)
        .map((e) => ({
          id: e.id,
          day: e.day,
          authorId: e.authorId,
          title: e.title,
          body: e.body,
          visibility: e.visibility,
          collabStatus: e.collabStatus,
          images: e.images.map((img) => img.url),
          reactions: e.reactions.map((r) => ({
            authorId: r.authorId,
            emoji: r.emoji,
            body: r.body,
            createdAt: r.createdAt.toISOString(),
          })),
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        })),
    ),
    jsonFile(
      "checkins.json",
      exportedAt,
      checkIns.map((c) => ({
        id: c.id,
        day: c.day,
        authorId: c.authorId,
        mood: c.mood,
        line: c.line,
        note: c.note,
        imageUrl: c.imageUrl,
        createdAt: c.createdAt.toISOString(),
      })),
    ),
    jsonFile(
      "daymarks.json",
      exportedAt,
      dayMarks.map((d) => ({
        id: d.id,
        day: d.day,
        title: d.title,
        note: d.note,
        yearly: d.yearly,
        authorId: d.authorId,
        createdAt: d.createdAt.toISOString(),
      })),
    ),
    jsonFile(
      "listitems.json",
      exportedAt,
      listItems.map((l) => ({
        id: l.id,
        category: l.category,
        title: l.title,
        status: l.status,
        completedAt: l.completedAt?.toISOString() ?? null,
        authorId: l.authorId,
        createdAt: l.createdAt.toISOString(),
      })),
    ),
    jsonFile(
      "notes.json",
      exportedAt,
      notes.map((n) => ({
        id: n.id,
        body: n.body,
        parentId: n.parentId,
        pinned: n.pinned,
        authorId: n.authorId,
        createdAt: n.createdAt.toISOString(),
      })),
    ),
    jsonFile(
      "letters.json",
      exportedAt,
      letters.map((l) => ({
        id: l.id,
        authorId: l.authorId,
        title: l.title,
        body: l.body,
        imageUrl: l.imageUrl,
        unlockDay: l.unlockDay,
        createdAt: l.createdAt.toISOString(),
      })),
    ),
  ];

  // —— 图片 ——
  const imageUrls = collectImageUrls([
    ...entries
      .filter((e) => e.visibility !== "private" || e.authorId === viewerId)
      .flatMap((e) => e.images.map((img) => img.url)),
    ...checkIns.map((c) => c.imageUrl),
    ...letters.map((l) => l.imageUrl),
  ]).slice(0, MAX_EXPORT_IMAGES);

  const imageMap: Record<string, string> = {};
  let failed = 0;
  let seq = 0;
  for (const url of imageUrls) {
    const bytes = await fetchImageBytes(url);
    if (!bytes) {
      failed += 1;
      continue;
    }
    seq += 1;
    const rawName = url.split("/").pop() ?? "image";
    const safeBase = rawName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
    const zipPath = `images/img-${String(seq).padStart(3, "0")}-${safeBase}`;
    imageMap[url] = zipPath;
    files.push({ name: zipPath, data: bytes });
  }

  files.push({
    name: "images.json",
    data: new TextEncoder().encode(
      JSON.stringify({ exportedAt, map: imageMap }, null, 2),
    ),
  });

  return {
    files,
    imageTotal: imageUrls.length,
    imageFailed: failed,
  };
}

export function exportZipFileName() {
  return `duet-export-${shanghaiDay()}.zip`;
}
