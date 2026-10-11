import { join } from "node:path";

import {
  AppSettingsSchema,
  DEFAULT_APP_SETTINGS,
  IPC_CHANNELS,
  type AppSettings,
  type CapabilityResult,
} from "@ado/shared";
import { app, BrowserWindow, ipcMain } from "electron";
import Store from "electron-store";
import { autoUpdater } from "electron-updater";

import { checkAccessibility, getSecret, probeDbus, probeFfi, setSecret } from "./native";

const SERVICE_NAME = "azdo-app";
const appRoot = join(__dirname, "..");

interface PersistedState {
  settings: AppSettings;
  windowBounds?: { width: number; height: number; x?: number; y?: number };
}

const store = new Store<PersistedState>({
  defaults: { settings: DEFAULT_APP_SETTINGS },
});

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.appVersion, () => app.getVersion());

  ipcMain.handle(IPC_CHANNELS.getSettings, () => store.get("settings"));

  ipcMain.handle(IPC_CHANNELS.setSettings, (_event, settings: unknown) => {
    const parsed = AppSettingsSchema.parse(settings);
    store.set("settings", parsed);
    return parsed;
  });

  ipcMain.handle(IPC_CHANNELS.getSecret, (_event, account: string) =>
    Promise.resolve(getSecret(SERVICE_NAME, account)),
  );

  ipcMain.handle(IPC_CHANNELS.setSecret, (_event, account: string, secret: string) =>
    Promise.resolve(setSecret(SERVICE_NAME, account, secret)),
  );

  ipcMain.handle(IPC_CHANNELS.accessibilityCheck, async (): Promise<CapabilityResult> =>
    checkAccessibility(),
  );

  ipcMain.handle(IPC_CHANNELS.dbusProbe, async (): Promise<CapabilityResult> => probeDbus());

  ipcMain.handle(IPC_CHANNELS.ffiProbe, async (): Promise<CapabilityResult> => probeFfi());
}

function createWindow(): BrowserWindow {
  const bounds = store.get("windowBounds");

  const window = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    minWidth: 900,
    minHeight: 600,
    title: "Azure DevOps App",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (bounds?.x !== undefined && bounds.y !== undefined) {
    window.setPosition(bounds.x, bounds.y);
  }

  window.on("close", () => {
    const [x, y] = window.getPosition();
    const [width, height] = window.getSize();
    store.set("windowBounds", { x, y, width, height });
  });

  const rendererUrl = process.env["ADO_RENDERER_URL"];
  if (typeof rendererUrl === "string" && rendererUrl.length > 0) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(join(appRoot, "dist", "renderer", "index.html"));
  }

  return window;
}

void app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Inert until electron-builder.yml gains a publish provider.
if (app.isPackaged) {
  autoUpdater.logger = console;
  autoUpdater.on("error", (error: Error) => {
    console.warn("[auto-update]", error.message);
  });
  void autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => {
    console.warn("[auto-update] check failed:", error);
  });
}
