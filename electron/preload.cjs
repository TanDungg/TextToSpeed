const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    // Các kênh được phép gửi đi
    const validChannels = ['start-autoclick', 'stop-autoclick'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  downloadFile: (url, filename) => {
    ipcRenderer.send('download-file', { url, filename });
  },
  ttsRequest: (url, options) => {
    return ipcRenderer.invoke('tts-request', { url, options });
  },
  on: (channel, func) => {
    // Các kênh được phép lắng nghe
    const validChannels = ['autoclick-status-changed'];
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  }
});