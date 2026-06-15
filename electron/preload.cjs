const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    // Các kênh được phép gửi đi
    const validChannels = [];
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
  separateBgm: (audioPath, bgmMode) => {
    return ipcRenderer.invoke('separate-bgm', { audioPath, bgmMode });
  },
  translateSegments: (segments, geminiKey, groqKey) => {
    return ipcRenderer.invoke('translate-segments', { segments, geminiKey, groqKey });
  },
  saveMetadata: (videoPath, metadata, thumbnailPrompt) => {
    return ipcRenderer.invoke('save-metadata', { videoPath, metadata, thumbnailPrompt });
  },
  publishVideo: (videoPath, metadata, platforms) => {
    return ipcRenderer.invoke('publish-video', { videoPath, metadata, platforms });
  },
  transcribeAudio: (audioPath, apiKey) => {
    return ipcRenderer.invoke('transcribe-audio', { audioPath, apiKey });
  },
  readFileBase64: (filePath) => {
    return ipcRenderer.invoke('read-file-base64', { filePath });
  },
  compressAudio: (inputPath) => {
    return ipcRenderer.invoke('compress-audio', { inputPath });
  },
  listGeminiModels: (apiKey) => {
    return ipcRenderer.invoke('list-gemini-models', { apiKey });
  },
  showItemInFolder: (filePath) => {
    return ipcRenderer.invoke('show-item-in-folder', { filePath });
  },
  selectFile: (type) => {
    return ipcRenderer.invoke('select-file', { type });
  },
  mediaEnhance: (inputPath, type, options) => {
    return ipcRenderer.invoke('media-enhance', { inputPath, type, options });
  },

  selectDirectory: () => {
    return ipcRenderer.invoke('select-directory');
  },
  gptGenerateBlendPrompt: (data) => {
    return ipcRenderer.invoke('gpt-generate-blend-prompt', data);
  },
  aiGenerateBlendedImage: (data) => {
    return ipcRenderer.invoke('ai-generate-blended-image', data);
  },
  aiImageToVideo: (data) => {
    return ipcRenderer.invoke('ai-image-to-video', data);
  },
  aiCharacterAnimate: (data) => {
    return ipcRenderer.invoke('ai-character-animate', data);
  },
  on: (channel, func) => {
    // Các kênh được phép lắng nghe
    const validChannels = ['media-enhance-progress'];
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  }
});