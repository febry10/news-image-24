// Entry point for "The World Today" — Tuesday 24 November 2026.
//
// The scored artefact is a single PNG image, not a running service.
// So this program does three things, in order:
//   1. validate the bundled poster.png against every hard limit
//      (real PNG, exactly 1024x1024, at most 1 MiB, properly closed);
//   2. copy those bytes unchanged to $MAKEFUN_OUTPUT_DIR/entry.png
//      (falling back to /output when the variable is unset);
//   3. read the copy back and compare SHA-256 digests, so a partial
//      or altered write can never slip through silently.
// It prints exactly one summary line and exits 0 on success. There
// are no timestamps and no random inputs anywhere below, which is
// what makes repeated runs byte-for-byte deterministic. The poster
// itself is rendered from poster.html (headless Chromium, 1024x1024)
// and committed as poster.png; this file only validates and copies it.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const posterPath = join(here, "poster.png");
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const outPath = join(outDir, "entry.png");

const LIMIT = 1048576;
const W = 1024;
const H = 1024;
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function die(msg: string): never {
  throw new Error(msg);
}

function check(data: Buffer): void {
  // An empty file would also fail the signature test, but naming the
  // actual problem makes a broken render much faster to diagnose.
  if (data.length === 0) die("poster.png is empty");
  if (data.length > LIMIT) die(`too large: ${data.length} > ${LIMIT}`);
  if (data.length < 33) die("file too short for a PNG");
  if (!data.subarray(0, 8).equals(SIG)) die("bad PNG signature");
  if (data.toString("latin1", 12, 16) !== "IHDR") die("missing IHDR");
  if (data.readUInt32BE(16) !== W || data.readUInt32BE(20) !== H) {
    die(`dimensions ${data.readUInt32BE(16)}x${data.readUInt32BE(20)} != 1024x1024`);
  }
  if (data.toString("latin1", data.length - 8, data.length - 4) !== "IEND") {
    die("missing IEND trailer");
  }
}

function digest(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

const data = readFileSync(posterPath);
check(data);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
copyFileSync(posterPath, outPath);
const back = readFileSync(outPath);
if (digest(back) !== digest(data)) die("entry.png differs from poster.png");
console.log(`entry.png OK: ${data.length} bytes, 1024x1024, sha256 ${digest(data).slice(0, 16)}…`);
