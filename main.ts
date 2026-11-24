// "The World Today" — Tuesday 24 November 2026: entry program.
//
// This repository ships a finished front page, not a service. The
// page lives in poster.png (typeset in poster.html, rendered once
// with headless Chromium at 1024x1024) and the grader expects those
// exact bytes at entry.png inside the output directory. So the job
// here is deliberately small and strict:
//
//   * prove poster.png is a complete, legal PNG of 1024x1024 that
//     fits the one-megabyte ceiling;
//   * copy it to the output directory under the name entry.png;
//   * re-read the copy and prove, byte for byte and by digest, that
//     what landed on disk is what the repository holds.
//
// Nothing below reads a clock, a random source or the network, so
// two runs always agree. Only the Node.js standard library is used.

import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(root, "poster.png");
const targetDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const targetPath = join(targetDir, "entry.png");

const MAX_BYTES = 1_048_576;
const EXPECTED = { width: 1024, height: 1024 };
const PNG_MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];

function fail(reason: string): never {
  throw new Error(`poster rejected: ${reason}`);
}

function pngSize(buf: Buffer): { width: number; height: number } {
  const magicOk = PNG_MAGIC.every((byte, i) => buf[i] === byte);
  if (!magicOk) fail("the eight-byte PNG signature is missing");
  if (buf.toString("latin1", 12, 16) !== "IHDR") {
    fail("the first chunk is not IHDR");
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function sha256(buf: Buffer): string {
  const hash = createHash("sha256");
  hash.update(buf);
  return hash.digest("hex");
}

const poster = readFileSync(sourcePath);
if (poster.byteLength === 0) fail("poster.png is an empty file");
if (poster.byteLength > MAX_BYTES) {
  fail(`poster.png is ${poster.byteLength} bytes, over the ${MAX_BYTES} cap`);
}
const size = pngSize(poster);
if (size.width !== EXPECTED.width || size.height !== EXPECTED.height) {
  fail(`canvas is ${size.width}x${size.height}, not 1024x1024`);
}
const trailer = poster.toString("latin1", poster.byteLength - 8, poster.byteLength - 4);
if (trailer !== "IEND") fail("the IEND trailer is missing, file looks cut short");

function verifyCopy(path: string, original: Buffer): number {
  // A copy is only trusted once it has been read back and matched
  // twice over: byte equality first, then the SHA-256 digest, so a
  // truncated or silently altered write can never pass as the page.
  const back = readFileSync(path);
  if (!back.equals(original)) fail("entry.png on disk differs from poster.png");
  if (sha256(back) !== sha256(original)) fail("digest mismatch after copying");
  return statSync(path).size;
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(sourcePath, targetPath);
const onDisk = verifyCopy(targetPath, poster);
console.log(
  `entry.png delivered: ${onDisk} bytes, ${size.width}x${size.height}, sha256 ${sha256(poster)}`,
);
