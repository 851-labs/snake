#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { chmodSync, existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir, homedir } from "node:os";
import { join, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import https from "node:https";
import pkg from "../package.json" assert { type: "json" };

const SUPPORTED_PLATFORMS = new Set(["darwin", "linux"]);
const SUPPORTED_ARCHES = new Set(["x64", "arm64"]);

const platform = process.platform;
const arch = process.arch;

if (!SUPPORTED_PLATFORMS.has(platform) || !SUPPORTED_ARCHES.has(arch)) {
  console.error(`Unsupported platform: ${platform}-${arch}`);
  process.exit(1);
}

const version = pkg.version;
const releaseBase = `https://github.com/851-labs/snake/releases/download/v${version}`;
const tarball = `snake-${platform}-${arch}.tar.gz`;
const checksumsName = "SHA256SUMS";

const cacheRoot = getCacheRoot();
const versionDir = join(cacheRoot, version);
const tarballPath = join(versionDir, tarball);
const checksumsPath = join(versionDir, checksumsName);
const binaryPath = join(versionDir, "snake");

await mkdir(versionDir, { recursive: true });

try {
  if (!existsSync(binaryPath)) {
    await downloadIfNeeded(`${releaseBase}/${checksumsName}`, checksumsPath);
    await downloadIfNeeded(`${releaseBase}/${tarball}`, tarballPath);

    const expected = await readChecksum(checksumsPath, tarball);
    const actual = await sha256File(tarballPath);
    if (expected !== actual) {
      throw new Error(`Checksum mismatch for ${tarball}`);
    }

    extractTarball(tarballPath, versionDir);
    chmodSync(binaryPath, 0o755);
  }
} catch (error) {
  console.error(`Failed to install snake binary: ${error.message}`);
  console.error(`Try downloading manually: ${releaseBase}/${tarball}`);
  process.exit(1);
}

const result = spawnSync(binaryPath, process.argv.slice(2), {
  stdio: "inherit",
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 0);

function getCacheRoot() {
  if (platform === "darwin") {
    return join(homedir(), "Library", "Caches", "851-labs", "snake");
  }
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg && xdg.length > 0) {
    return join(xdg, "851-labs", "snake");
  }
  return join(homedir(), ".cache", "851-labs", "snake");
}

async function downloadIfNeeded(url, destination) {
  if (existsSync(destination)) {
    return;
  }
  const tempPath = join(tmpdir(), `snake-${Date.now()}-${Math.random()}`);
  await downloadFile(url, tempPath);
  await mkdir(dirname(destination), { recursive: true });
  const data = await readFile(tempPath);
  await writeFile(destination, data);
}

async function downloadFile(url, destination, redirectCount = 0) {
  const response = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      resolve(res);
    }).on("error", reject);
  });

  if (
    response.statusCode &&
    [301, 302, 303, 307, 308].includes(response.statusCode) &&
    response.headers.location
  ) {
    if (redirectCount > 5) {
      throw new Error(`Too many redirects for ${url}`);
    }
    response.resume();
    return downloadFile(response.headers.location, destination, redirectCount + 1);
  }

  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(`Download failed (${response.statusCode}) for ${url}`);
  }

  const file = createWriteStream(destination);
  await pipeline(response, file);
}

async function readChecksum(checksumsFile, filename) {
  const content = await readFile(checksumsFile, "utf8");
  const line = content
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => {
      if (!entry) {
        return false;
      }
      const parts = entry.split(/\s+/);
      const file = parts[parts.length - 1];
      return file === filename || file.endsWith(`/${filename}`);
    });
  if (!line) {
    throw new Error(`Checksum entry not found for ${filename}`);
  }
  return line.split(/\s+/)[0];
}

async function sha256File(filePath) {
  const data = await readFile(filePath);
  const hash = createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

function extractTarball(tarPath, destination) {
  const result = spawnSync("tar", ["-xzf", tarPath, "-C", destination], {
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error("Failed to extract tarball");
  }
}
