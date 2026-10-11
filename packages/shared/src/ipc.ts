import type { AppSettings } from "./settings";

/** Shared so a rename is a compile error, not a runtime mystery. */
export const IPC_CHANNELS = {
  appVersion: "app:version",
  getSettings: "settings:get",
  setSettings: "settings:set",
  getSecret: "secrets:get",
  setSecret: "secrets:set",
  accessibilityCheck: "a11y:check",
  dbusProbe: "dbus:probe",
  ffiProbe: "ffi:probe",
} as const;

export interface CapabilityResult {
  ok: boolean;
  detail: string;
}

/** Preload surface exposed as `window.azdo`. */
export interface AzdoBridge {
  appVersion(): Promise<string>;
  getSettings(): Promise<AppSettings>;
  setSettings(settings: AppSettings): Promise<AppSettings>;
  getSecret(account: string): Promise<string | null>;
  setSecret(account: string, secret: string): Promise<void>;
  checkAccessibility(): Promise<CapabilityResult>;
  probeDbus(): Promise<CapabilityResult>;
  probeFfi(): Promise<CapabilityResult>;
}

declare global {
  interface Window {
    azdo: AzdoBridge;
  }
}
