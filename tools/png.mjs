// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 最小 PNG 编解码（只给离线编码器用，不进运行时）。
 *
 * 支持：8 位、非隔行、RGBA(6) / RGB(2)。
 * 不支持：调色板、灰度、16 位、隔行——遇到直接报错，不猜。
 *
 * 为什么手写：项目不引入图片库；编码器只需要「解成 RGBA → 拼大图 → 写回 PNG」。
 */

import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * 解码 PNG → { width, height, rgba }。
 * @param {Buffer} buffer
 */
export function decodePng(buffer, where = "png") {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error(`${where}：不是 PNG`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      colorType = data[9];
      if (depth !== 8) throw new Error(`${where}：只支持 8 位 PNG`);
      if (colorType !== 6 && colorType !== 2) {
        throw new Error(`${where}：只支持 RGB(2) / RGBA(6) PNG（收到 ${colorType}）`);
      }
      if (data[12] !== 0) throw new Error(`${where}：不支持隔行 PNG`);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (width === 0 || height === 0) throw new Error(`${where}：缺少 IHDR`);
  if (idat.length === 0) throw new Error(`${where}：缺少 IDAT`);

  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) throw new Error(`${where}：像素数据长度不对`);

  const rgba = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride);
  const line = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const start = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[start + x];
      const left = x >= bpp ? line[x - bpp] : 0;
      const up = prev[x];
      const upLeft = x >= bpp ? prev[x - bpp] : 0;
      let out;
      switch (filter) {
        case 0: out = value; break;
        case 1: out = (value + left) & 0xff; break;
        case 2: out = (value + up) & 0xff; break;
        case 3: out = (value + ((left + up) >> 1)) & 0xff; break;
        case 4: out = (value + paeth(left, up, upLeft)) & 0xff; break;
        default: throw new Error(`${where}：未知行过滤器 ${filter}`);
      }
      line[x] = out;
    }

    for (let x = 0; x < width; x += 1) {
      const source = x * bpp;
      const target = (y * width + x) * 4;
      rgba[target] = line[source];
      rgba[target + 1] = line[source + 1];
      rgba[target + 2] = line[source + 2];
      rgba[target + 3] = bpp === 4 ? line[source + 3] : 255;
    }
    line.copy(prev);
  }

  return { width, height, rgba };
}

/**
 * 编码 RGBA → PNG（无过滤，压缩交给 zlib）。
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgba
 */
export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 把一张 RGBA 图贴到目标画布的 (x, y)。 */
export function blit(dst, dstWidth, src, srcWidth, srcHeight, x, y) {
  for (let row = 0; row < srcHeight; row += 1) {
    const from = row * srcWidth * 4;
    const to = ((y + row) * dstWidth + x) * 4;
    src.copy(dst, to, from, from + srcWidth * 4);
  }
}
