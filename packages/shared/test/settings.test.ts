import { describe, expect, it } from "vitest";

import { AppSettingsSchema, DEFAULT_APP_SETTINGS, type Theme } from "../src/settings";

describe("AppSettingsSchema", () => {
  it("applies defaults for missing fields", () => {
    const settings = AppSettingsSchema.parse({ theme: "dark" });
    expect(settings).toEqual({
      theme: "dark",
      patAccount: DEFAULT_APP_SETTINGS.patAccount,
    });
  });

  it("rejects unknown themes", () => {
    expect(() => AppSettingsSchema.parse({ theme: "neon" })).toThrow();
  });

  it("rejects an empty pat account", () => {
    expect(() => AppSettingsSchema.parse({ theme: "light", patAccount: "" })).toThrow();
  });

  it("round-trips every theme", () => {
    const themes: Theme[] = ["light", "dark", "system"];
    for (const theme of themes) {
      expect(AppSettingsSchema.parse({ theme, patAccount: "x" })).toEqual({
        theme,
        patAccount: "x",
      });
    }
  });
});
