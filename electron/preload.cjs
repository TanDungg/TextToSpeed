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
  videoDownload: (url) => {
    return ipcRenderer.invoke('video-download', { url });
  },
  videoRemake: (inputPath, options) => {
    return ipcRenderer.invoke('video-remake', { inputPath, options });
  },
  checkEnv: () => {
    return ipcRenderer.invoke('check-env');
  },
  saveTempAudio: (buffer, ext) => {
    return ipcRenderer.invoke('save-temp-audio', { buffer, ext });
  },
  extractAudio: (videoPath) => {
    return ipcRenderer.invoke('extract-audio', { videoPath });
  },
  transcribeAudio: (audioPath, apiKey) => {
    return ipcRenderer.invoke('transcribe-audio', { audioPath, apiKey });
  },
  readFileBase64: (filePath) => {
    return ipcRenderer.invoke('read-file-base64', { filePath });
  },
  listGeminiModels: (apiKey) => {
    return ipcRenderer.invoke('list-gemini-models', { apiKey });
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