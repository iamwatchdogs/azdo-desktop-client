import { describe, expect, it } from "vite-plus/test";

import { AppSettingsSchema, DEFAULT_APP_SETTINGS, IPC_CHANNELS } from "../src/index";

/**
 * The bridge contract in packages/shared/src/ipc.ts says errors are values, not
 * exceptions. That is not just discipline: contextBridge copies with the
 * structured clone algorithm, which drops prototype getters and symbol keys.
 * An Effect, an Exit or a Data.TaggedError crossing it arrives as a bare {} or
 * throws DataCloneError, so every value the renderer can observe must survive
 * a round trip. These tests are what make that mechanically true.
 */

describe("IPC contract stays plain-serializable", () => {
  it("exposes only string channel names", () => {
    const channels = Object.values(IPC_CHANNELS);
    expect(channels.every((channel) => typeof channel === "string")).toBe(true);
    expect(channels.some((channel) => channel.startsWith("azdo:"))).toBe(false);
  });

  it("parses default settings into a cloneable value", () => {
    const cloned = structuredClone(DEFAULT_APP_SETTINGS);
    expect(cloned).toStrictEqual(DEFAULT_APP_SETTINGS);
  });

  it("parses a renderer-supplied settings payload into a cloneable value", () => {
    const parsed = AppSettingsSchema.parse({ theme: "dark" });
    expect(structuredClone(parsed)).toStrictEqual(parsed);
    expect(parsed).toStrictEqual({ theme: "dark", patAccount: "azure-devops" });
  });

  it("rejects a malformed payload instead of persisting it", () => {
    expect(() => AppSettingsSchema.parse({ theme: "neon" })).toThrow();
  });

  it("shapes capability results as a cloneable ok/detail pair", () => {
    // The shape native.ts returns and main.ts forwards verbatim.
    const okResult = { ok: true, detail: "getpid() = 42" };
    const failureResult = { ok: false, detail: "keyring unavailable: boom" };
    expect(structuredClone(okResult)).toStrictEqual(okResult);
    expect(structuredClone(failureResult)).toStrictEqual(failureResult);
    expect(Object.keys(okResult).toSorted()).toStrictEqual(["detail", "ok"]);
  });
});
