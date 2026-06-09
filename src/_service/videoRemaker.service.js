// src/_service/videoRemaker.service.js
const isElectronEnv = () => window.electron && !window.electron.isWebMock;

const handleJsonResponse = async (response, defaultErrorMsg) => {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: `Lỗi hệ thống (${response.status}): Phản hồi từ máy chủ không hợp lệ.` };
  }
  if (!response.ok) {
    return { ok: false, error: data.error || defaultErrorMsg };
  }
  return data;
};

export const VideoRemakerService = {
  checkEnv: async () => {
    if (isElectronEnv()) {
      return await window.electron.checkEnv();
    }
    try {
      const res = await fetch('/api/check-env');
      const text = await res.text();
      return JSON.parse(text);
    } catch {
      return { ffmpeg: false, ytdlp: false };
    }
  },

  videoDownload: async (url) => {
    if (isElectronEnv()) {
      return await window.electron.videoDownload(url);
    }
    const response = await fetch('/api/video-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return await handleJsonResponse(response, 'Tải video từ Cloud thất bại.');
  },

  videoRemake: async (videoPath, options) => {
    if (isElectronEnv()) {
      return await window.electron.videoRemake(videoPath, options);
    }
    const response = await fetch('/api/video-remake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, options: typeof options === 'string' ? options : JSON.stringify(options) }),
    });
    return await handleJsonResponse(response, 'Lách video thất bại trên Cloud.');
  },

  extractAudio: async (videoPath) => {
    if (isElectronEnv()) {
      return await window.electron.extractAudio(videoPath);
    }
    const response = await fetch('/api/extract-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath }),
    });
    return await handleJsonResponse(response, 'Trích xuất âm thanh từ Cloud thất bại.');
  },

  transcribeAudio: async (audioPath, apiKey) => {
    if (isElectronEnv()) {
      return await window.electron.transcribeAudio(audioPath, apiKey);
    }
    const response = await fetch('/api/transcribe-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioPath, apiKey }),
    });
    return await handleJsonResponse(response, 'Nhận diện giọng nói từ Cloud thất bại.');
  },

  readFileBase64: async (filePath) => {
    if (isElectronEnv()) {
      return await window.electron.readFileBase64(filePath);
    }
    const response = await fetch('/api/read-file-base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    return await handleJsonResponse(response, 'Đọc file từ Cloud thất bại.');
  },

  ttsRequest: async (url, options = {}) => {
    if (isElectronEnv()) {
      return await window.electron.ttsRequest(url, options);
    }
    const response = await fetch('/api/tts-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, options }),
    });
    const result = await handleJsonResponse(response, 'Yêu cầu Proxy thất bại.');
    if (result.ok && result.isBinary && typeof result.data === 'string') {
      const binaryString = window.atob(result.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      result.data = bytes.buffer;
    }
    return result;
  },

  saveTempAudio: async (audioBlobOrBuffer) => {
    if (isElectronEnv()) {
      const arrayBuffer = audioBlobOrBuffer instanceof ArrayBuffer
        ? audioBlobOrBuffer
        : await audioBlobOrBuffer.arrayBuffer();
      return await window.electron.saveTempAudio(arrayBuffer);
    }
    const blob = audioBlobOrBuffer instanceof Blob
      ? audioBlobOrBuffer
      : new Blob([audioBlobOrBuffer], { type: 'audio/mpeg' });
    const formData = new FormData();
    formData.append('file', blob, `voice-${Date.now()}.mp3`);
    const response = await fetch('/api/save-temp-audio', {
      method: 'POST',
      body: formData,
    });
    const text = await response.text();
    let uploadData;
    try {
      uploadData = JSON.parse(text);
    } catch {
      throw new Error(`Lỗi hệ thống (${response.status}): Phản hồi từ máy chủ không hợp lệ.`);
    }
    if (!response.ok) {
      throw new Error(uploadData.error || 'Không thể lưu file âm thanh tạm thời trên Cloud.');
    }
    return uploadData.path;
  },

  showItemInFolder: (filePath) => {
    if (isElectronEnv()) {
      window.electron.showItemInFolder(filePath);
    } else {
      console.log('Mở thư mục chứa file:', filePath);
    }
  }
};

export default VideoRemakerService;
