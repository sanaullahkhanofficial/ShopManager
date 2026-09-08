const { contextBridge, ipcRenderer } = require("electron");

// Keep the renderer API small and predictable while supporting any number of IPC arguments.
// This matches Electron's ipcRenderer.invoke(channel, ...args) contract.
contextBridge.exposeInMainWorld("api", {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});
