/**
 * Copies the build into the API's public/ so it can serve it as a static SPA.
 * Uses node:fs/promises directly instead of shelling out to `rm`/`cp`: those
 * are POSIX commands with no equivalent in cmd.exe, so a shelled-out version
 * would fail outright on Windows.
 */
import { cp, rm } from "node:fs/promises";

const target = "../manga-tracker-api/public";

await rm(target, { recursive: true, force: true });
await cp("dist", target, { recursive: true });

console.log(`Copied dist/ → ${target}`);
