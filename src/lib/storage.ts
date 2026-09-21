import { randomBytes } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client, type ObjectCannedACL } from "@aws-sdk/client-s3";

export type UploadKind = "avatar" | "checkin" | "entry";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

type CosConfig = {
  bucket: string;
  region: string;
  secretId: string;
  secretKey: string;
  /** 自定义 CDN / 加速域名，无尾斜杠 */
  publicBase?: string;
  /** 默认 public-read，便于浏览器直读；私有桶请改 bucket 策略 + 签名 URL（V1 不做） */
  objectAcl?: ObjectCannedACL;
};

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3000"
  );
}

function parseAcl(raw: string | undefined): ObjectCannedACL | undefined {
  if (!raw) return "public-read";
  const allowed: ObjectCannedACL[] = [
    "private",
    "public-read",
    "public-read-write",
    "authenticated-read",
    "aws-exec-read",
    "bucket-owner-read",
    "bucket-owner-full-control",
  ];
  return allowed.includes(raw as ObjectCannedACL)
    ? (raw as ObjectCannedACL)
    : "public-read";
}

/** 腾讯云 COS（优先 COS_*；兼容旧 S3_* 别名） */
function cosConfig(): CosConfig | null {
  const bucket = process.env.COS_BUCKET || process.env.S3_BUCKET;
  const region = process.env.COS_REGION || process.env.S3_REGION;
  const secretId =
    process.env.COS_SECRET_ID || process.env.S3_ACCESS_KEY_ID;
  const secretKey =
    process.env.COS_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !region || !secretId || !secretKey) return null;

  const publicBase = (
    process.env.COS_PUBLIC_URL ||
    process.env.S3_PUBLIC_URL ||
    ""
  ).replace(/\/$/, "");

  return {
    bucket,
    region,
    secretId,
    secretKey,
    publicBase: publicBase || undefined,
    objectAcl: parseAcl(process.env.COS_OBJECT_ACL),
  };
}

function useCos() {
  return cosConfig() !== null;
}

function cosClient(cfg: CosConfig) {
  // 腾讯云 COS S3 兼容：https://cloud.tencent.com/document/product/436/37421
  return new S3Client({
    region: cfg.region,
    endpoint: `https://cos.${cfg.region}.myqcloud.com`,
    // 虚拟主机风格：{bucket}.cos.{region}.myqcloud.com
    forcePathStyle: false,
    credentials: {
      accessKeyId: cfg.secretId,
      secretAccessKey: cfg.secretKey,
    },
  });
}

function publicUrlForKey(key: string, cfg: CosConfig | null) {
  if (!cfg) return `${appUrl()}/api/files/${key}`;
  if (cfg.publicBase) return `${cfg.publicBase}/${key}`;
  // 默认 COS 公网域名（桶需可匿名读，或挂 CDN 到 COS_PUBLIC_URL）
  return `https://${cfg.bucket}.cos.${cfg.region}.myqcloud.com/${key}`;
}

export function assertImageMeta(contentType: string, size: number) {
  if (!ALLOWED.has(contentType)) {
    return "仅支持 JPEG / PNG / WebP / GIF";
  }
  if (size <= 0 || size > MAX_BYTES) {
    return "图片需小于 5MB";
  }
  return null;
}

export function extForContentType(contentType: string) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

function buildKey(
  spaceId: string,
  kind: UploadKind,
  userId: string,
  ext: string,
) {
  const id = randomBytes(8).toString("hex");
  const prefix = (process.env.COS_KEY_PREFIX || "duet").replace(
    /^\/+|\/+$/g,
    "",
  );
  return `${prefix}/${spaceId}/${kind}/${userId}/${Date.now()}-${id}.${ext}`;
}

export async function putImageObject(opts: {
  kind: UploadKind;
  spaceId: string;
  userId: string;
  bytes: Buffer;
  contentType: string;
}): Promise<{ key: string; url: string }> {
  const err = assertImageMeta(opts.contentType, opts.bytes.length);
  if (err) throw new Error(err);

  const ext = extForContentType(opts.contentType);
  const key = buildKey(opts.spaceId, opts.kind, opts.userId, ext);
  const cfg = cosConfig();

  if (cfg) {
    await cosClient(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: opts.bytes,
        ContentType: opts.contentType,
        CacheControl: "public, max-age=31536000, immutable",
        ...(cfg.objectAcl ? { ACL: cfg.objectAcl } : {}),
      }),
    );
  } else {
    const full = path.join(LOCAL_ROOT, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, opts.bytes);
  }

  return { key, url: publicUrlForKey(key, cfg) };
}

/** 仅本地驱动读取；COS 公网直链不走此路径 */
export async function readLocalObject(key: string) {
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.includes("..")) return null;
  const full = path.join(LOCAL_ROOT, normalized);
  if (!full.startsWith(LOCAL_ROOT)) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}

export function contentTypeFromKey(key: string) {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

export function storageDriver(): "cos" | "local" {
  return useCos() ? "cos" : "local";
}

export const UPLOAD_MAX_BYTES = MAX_BYTES;
