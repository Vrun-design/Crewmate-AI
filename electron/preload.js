const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getDesktopSourceId: () => ipcRenderer.invoke('get-desktop-source-id'),
});
