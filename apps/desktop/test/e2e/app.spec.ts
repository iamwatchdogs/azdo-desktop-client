import { fileURLToPath } from "node:url";

import { test, expect, _electron as electron } from "@playwright/test";

const appRoot = fileURLToPath(new URL("../..", import.meta.url));
const mainEntry = fileURLToPath(new URL("../../dist-electron/main.cjs", import.meta.url));

test("launches and exposes the preload bridge", async () => {
  const app = await electron.launch({ args: [mainEntry], cwd: appRoot });
  try {
    const window = await app.firstWindow();
    await expect(window).toHaveTitle("Azure DevOps App");
    await expect(window.locator("#app-shell")).toBeAttached();
    expect(await window.evaluate(() => typeof (window as unknown as { azdo?: unknown }).azdo)).toBe(
      "object",
    );
  } finally {
    await app.close();
  }
});
