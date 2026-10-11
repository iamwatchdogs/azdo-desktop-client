/**
 * Dev runner: renderer dev server + main/preload watch build + Electron.
 * Ctrl+C tears everything down.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

const RENDERER_PORT = 5173;
const RENDERER_URL = `http://localhost:${RENDERER_PORT}`;

const desktopRoot = process.cwd();
const rendererRoot = join(desktopRoot, "..", "renderer");
const vpBin = (root: string): string => join(root, "node_modules", ".bin", "vp");
const electronBin = require("electron") as string;
const mainEntry = join(desktopRoot, "dist-electron", "main.cjs");
const preloadEntry = join(desktopRoot, "dist-electron", "preload.cjs");

const children: ChildProcess[] = [];
let electronProcess: ChildProcess | undefined;
let restartTimer: ReturnType<typeof setTimeout> | undefined;

function shutdown(code: number): never {
  if (restartTimer) clearTimeout(restartTimer);
  for (const child of children) {
    child.kill();
  }
  electronProcess?.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function launchElectron(): void {
  electronProcess = spawn(electronBin, [mainEntry], {
    cwd: desktopRoot,
    stdio: "inherit",
    env: { ...process.env, ADO_RENDERER_URL: RENDERER_URL },
  });
  electronProcess.on("exit", () => {
    electronProcess = undefined;
  });
}

function scheduleElectronRestart(): void {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (electronProcess) {
      electronProcess.once("exit", launchElectron);
      electronProcess.kill();
    } else {
      launchElectron();
    }
  }, 300);
}

function waitForProcessArtifacts(): void {
  const timer = setInterval(() => {
    if (!existsSync(mainEntry) || !existsSync(preloadEntry)) {
      return;
    }
    clearInterval(timer);
    launchElectron();
    watch(mainEntry, scheduleElectronRestart);
  }, 150);
}

console.log(`[dev] renderer dev server on ${RENDERER_URL}`); // debug-statements: allow
children.push(spawn(vpBin(rendererRoot), ["dev"], { cwd: rendererRoot, stdio: "inherit" }));
children.push(
  spawn(vpBin(desktopRoot), ["pack", "--watch"], { cwd: desktopRoot, stdio: "inherit" }),
);

waitForProcessArtifacts();
