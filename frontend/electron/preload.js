/**
 * WashControl — Electron preload
 * Безопасный мост между renderer и main process
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getApiUrl:       () => ipcRenderer.invoke('get-api-url'),
  openDataFolder:  () => ipcRenderer.invoke('open-data-folder'),
  showMessage:     (opts) => ipcRenderer.invoke('show-message', opts),
})
