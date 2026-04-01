const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronBridge', {
  onMpvClosed: (callback) => {
    ipcRenderer.on('mpv:closed', callback);
  },
  reopenMpv: (position) => {
    ipcRenderer.invoke('mpv:reopen', { position });
  },
});
