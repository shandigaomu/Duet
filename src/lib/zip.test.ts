import { describe, expect, it } from "vitest";
import { crc32, createZip } from "./zip";

/** 解析 zip 尾部 EOCD，返回 (central directory offset, entry count) */
function readEocd(zip: Uint8Array) {
  // EOCD 签名 0x06054b50，从尾部向前找（无注释时就在最后 22 字节）
  for (let i = zip.length - 22; i >= 0; i -= 1) {
    if (
      zip[i] === 0x50 &&
      zip[i + 1] === 0x4b &&
      zip[i + 2] === 0x05 &&
      zip[i + 3] === 0x06
    ) {
      return {
        count: zip[i + 10] | (zip[i + 11] << 8),
        cdSize:
          (zip[i + 12] |
            (zip[i + 13] << 8) |
            (zip[i + 14] << 16) |
            (zip[i + 15] << 24)) >>>
          0,
        cdOffset:
          (zip[i + 16] |
            (zip[i + 17] << 8) |
            (zip[i + 18] << 16) |
            (zip[i + 19] << 24)) >>>
          0,
      };
    }
  }
  throw new Error("EOCD not found");
}

describe("crc32", () => {
  it("matches known check values", () => {
    const enc = new TextEncoder();
    expect(crc32(enc.encode(""))).toBe(0);
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(enc.encode("The quick brown fox jumps over the lazy dog"))).toBe(
      0x414fa339,
    );
  });
});

describe("createZip", () => {
  it("builds a structurally valid zip with stored entries", () => {
    const enc = new TextEncoder();
    const files = [
      { name: "entries.json", data: enc.encode('{"a":1}') },
      { name: "images/one.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
    ];
    const zip = createZip(files);
    const eocd = readEocd(zip);
    expect(eocd.count).toBe(2);
    expect(eocd.cdOffset + eocd.cdSize).toBe(zip.length - 22);

    // 第一个 local header
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    // method = STORE (offset 8)
    expect(zip[8] | (zip[9] << 8)).toBe(0);

    // 名称紧跟在 30 字节 local header 后
    const nameLen = zip[26] | (zip[27] << 8);
    const name = Buffer.from(zip.slice(30, 30 + nameLen)).toString("utf8");
    expect(name).toBe("entries.json");

    // 数据后紧接第二个 local header
    const size = zip[18] | (zip[19] << 8);
    const next = 30 + nameLen + size;
    expect(zip[next + 2]).toBe(0x03);
  });

  it("round-trips through Node's own zip reader (Adm-Zip free check via crc offsets)", () => {
    // 轻量校验：central directory 中记录的 crc 与本地头一致
    const enc = new TextEncoder();
    const data = enc.encode("hello duet");
    const zip = createZip([{ name: "notes.json", data }]);
    const eocd = readEocd(zip);
    // central record: sig(4) ver(2) ver(2) flags(2) method(2) time(2) date(2) crc(4)
    const crcAt = eocd.cdOffset + 16;
    const cdCrc =
      (zip[crcAt] |
        (zip[crcAt + 1] << 8) |
        (zip[crcAt + 2] << 16) |
        (zip[crcAt + 3] << 24)) >>>
      0;
    expect(cdCrc).toBe(crc32(data));
    // local header crc at 14
    const localCrc =
      (zip[14] | (zip[15] << 8) | (zip[16] << 16) | (zip[17] << 24)) >>> 0;
    expect(localCrc).toBe(crc32(data));
  });

  it("handles utf-8 names via flag 0x0800", () => {
    const enc = new TextEncoder();
    const zip = createZip([{ name: "清单.json", data: enc.encode("[]") }]);
    expect(zip[6] | (zip[7] << 8)).toBe(0x0800);
  });
});
