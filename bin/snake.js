#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const isBun = Boolean(process.versions?.bun);

if (!isBun) {
  const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
  const result = spawnSync("bun", ["run", entry], { stdio: "inherit" });
  if (result.error) {
    console.error("Bun is required to run this CLI.");
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

await import("../dist/index.js");
