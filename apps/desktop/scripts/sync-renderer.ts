// Copies the renderer bundle into dist/renderer so electron-builder can package it.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const desktopRoot = join(import.meta.dirname, "..");
const source = join(desktopRoot, "..", "renderer", "dist");
const target = join(desktopRoot, "dist", "renderer");

rmSync(target, { recursive: true, force: true });
mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`[build] renderer copied to ${target}`);
