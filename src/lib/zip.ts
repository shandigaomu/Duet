/**
 * V3-F2 数据导出：零依赖 ZIP 打包器。
 *
 * 只实现 STORE（不压缩）模式——图片本就已是压缩格式，文本量级小，
 * 换取实现简单、无平台依赖。结构：local file header ×N + central directory + EOCD。
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export type ZipEntry = {
  /** zip 内路径，如 "entries.json" 或 "images/xxx.jpg"（用 / 分隔） */
  name: string;
  data: Uint8Array;
};

/** DOS 时间：ZIP 只有 2 秒精度，日期固定用导出时刻（本地时区） */
function dosDateTime(now = new Date()): { time: number; date: number } {
  const time =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();
  return { time, date };
}

function u16(buf: Uint8Array, offset: number, value: number) {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

function u32(buf: Uint8Array, offset: number, value: number) {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

export function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime();

  type Central = {
    name: Uint8Array;
    crc: number;
    size: number;
    offset: number;
  };
  const centrals: Central[] = [];

  // 先算总长，一次分配
  let total = 0;
  const parts: Array<{ name: Uint8Array; data: Uint8Array; crc: number }> = [];
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    parts.push({ name, data: entry.data, crc });
    total += 30 + name.length + entry.data.length; // local header + name + data
  }
  for (const part of parts) {
    total += 46 + part.name.length; // central directory record
  }
  total += 22; // EOCD

  const zip = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    const headerOffset = offset;
    // Local file header
    u32(zip, offset, 0x04034b50);
    u16(zip, offset + 4, 20); // version needed
    u16(zip, offset + 6, 0x0800); // flags: UTF-8 文件名
    u16(zip, offset + 8, 0); // method: STORE
    u16(zip, offset + 10, time);
    u16(zip, offset + 12, date);
    u32(zip, offset + 14, part.crc);
    u32(zip, offset + 18, part.data.length); // compressed
    u32(zip, offset + 22, part.data.length); // uncompressed
    u16(zip, offset + 26, part.name.length);
    u16(zip, offset + 28, 0); // extra len
    offset += 30;
    zip.set(part.name, offset);
    offset += part.name.length;
    zip.set(part.data, offset);
    offset += part.data.length;

    centrals.push({
      name: part.name,
      crc: part.crc,
      size: part.data.length,
      offset: headerOffset,
    });
  }

  const centralStart = offset;
  for (const c of centrals) {
    u32(zip, offset, 0x02014b50);
    u16(zip, offset + 4, 20); // version made by
    u16(zip, offset + 6, 20); // version needed
    u16(zip, offset + 8, 0x0800);
    u16(zip, offset + 10, 0); // STORE
    u16(zip, offset + 12, time);
    u16(zip, offset + 14, date);
    u32(zip, offset + 16, c.crc);
    u32(zip, offset + 20, c.size);
    u32(zip, offset + 24, c.size);
    u16(zip, offset + 28, c.name.length);
    u16(zip, offset + 30, 0); // extra
    u16(zip, offset + 32, 0); // comment
    u16(zip, offset + 34, 0); // disk start
    u16(zip, offset + 36, 0); // internal attrs
    u32(zip, offset + 38, 0); // external attrs
    u32(zip, offset + 42, c.offset);
    offset += 46;
    zip.set(c.name, offset);
    offset += c.name.length;
  }

  // End of central directory
  u32(zip, offset, 0x06054b50);
  u16(zip, offset + 4, 0); // disk
  u16(zip, offset + 6, 0); // cd disk
  u16(zip, offset + 8, centrals.length);
  u16(zip, offset + 10, centrals.length);
  u32(zip, offset + 12, offset - centralStart); // cd size
  u32(zip, offset + 16, centralStart);
  u16(zip, offset + 20, 0); // comment len

  return zip;
}

/** 导出文件名安全化：去路径分隔与控制字符 */
export function safeZipName(raw: string): string {
  return raw.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 120);
}
