import { IPC_CHANNELS, type AzdoBridge } from "@ado/shared";
import { contextBridge, ipcRenderer } from "electron";

const bridge: AzdoBridge = {
  appVersion: () => ipcRenderer.invoke(IPC_CHANNELS.appVersion),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  setSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.setSettings, settings),
  getSecret: (account) => ipcRenderer.invoke(IPC_CHANNELS.getSecret, account),
  setSecret: (account, secret) => ipcRenderer.invoke(IPC_CHANNELS.setSecret, account, secret),
  checkAccessibility: () => ipcRenderer.invoke(IPC_CHANNELS.accessibilityCheck),
  probeDbus: () => ipcRenderer.invoke(IPC_CHANNELS.dbusProbe),
  probeFfi: () => ipcRenderer.invoke(IPC_CHANNELS.ffiProbe),
};

contextBridge.exposeInMainWorld("azdo", bridge);
