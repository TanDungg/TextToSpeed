// src/_service/videoRemaker.service.js
import { BASE_URL_API } from '../constants/config';

const isElectronEnv = () => window.electron && !window.electron.isWebMock;

const shouldCallCloud = (settings) => {
  if (!isElectronEnv()) return true; // Chạy trên nền Web/Cloud thì bắt buộc dùng Cloud API
  return settings?.useCloudEngine === true; // Chạy trên App Desktop thì phụ thuộc vào cấu hình Toggle
};

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
  checkEnv: async (settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.checkEnv();
    }
    try {
      const res = await fetch(`${BASE_URL_API}/api/check-env`);
      const data = await res.json();
      return {
        ffmpeg: data.ffmpeg ?? true,
        ytdlp: data.ytdlp ?? true,
        demucs: data.demucs ?? true
      };
    } catch {
      return { ffmpeg: true, ytdlp: true, demucs: true };
    }
  },

  videoDownload: async (url, settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.videoDownload(url);
    }
    const response = await fetch(`${BASE_URL_API}/api/video-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return await handleJsonResponse(response, 'Tải video từ Cloud thất bại.');
  },

  videoRemake: async (videoPath, options, settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.videoRemake(videoPath, options);
    }
    const response = await fetch(`${BASE_URL_API}/api/video-remake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        videoPath, 
        options: typeof options === 'string' ? JSON.parse(options) : options 
      }),
    });
    return await handleJsonResponse(response, 'Lách video thất bại trên Cloud.');
  },

  extractAudio: async (videoPath, settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.extractAudio(videoPath);
    }
    const response = await fetch(`${BASE_URL_API}/api/extract-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath }),
    });
    return await handleJsonResponse(response, 'Trích xuất âm thanh từ Cloud thất bại.');
  },

  separateBgm: async (audioPath, bgmMode, settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.separateBgm(audioPath, bgmMode);
    }
    const response = await fetch(`${BASE_URL_API}/api/separate-bgm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioPath, bgmMode }),
    });
    return await handleJsonResponse(response, 'Tách nhạc nền từ Cloud thất bại.');
  },

  translateSegments: async (segments, geminiKey, groqKey, settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.translateSegments(segments, geminiKey, groqKey);
    }
    const response = await fetch(`${BASE_URL_API}/api/translate-segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments, geminiKey, groqKey }),
    });
    return await handleJsonResponse(response, 'Dịch thuật phân đoạn từ Cloud thất bại.');
  },

  saveMetadata: async (videoPath, metadata, thumbnailPrompt, settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.saveMetadata(videoPath, metadata, thumbnailPrompt);
    }
    const response = await fetch(`${BASE_URL_API}/api/save-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, metadata, thumbnailPrompt }),
    });
    return await handleJsonResponse(response, 'Lưu Metadata từ Cloud thất bại.');
  },

  publishVideo: async (videoPath, metadata, platforms, settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.publishVideo(videoPath, metadata, platforms);
    }
    const response = await fetch(`${BASE_URL_API}/api/publish-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoPath, metadata, platforms }),
    });
    return await handleJsonResponse(response, 'Đăng tải video từ Cloud thất bại.');
  },

  transcribeAudio: async (audioPath, apiKey, settings, provider) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.transcribeAudio(audioPath, apiKey);
    }
    const response = await fetch(`${BASE_URL_API}/api/transcribe-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioPath, apiKey, provider }),
    });
    return await handleJsonResponse(response, 'Nhận diện giọng nói từ Cloud thất bại.');
  },

  readFileBase64: async (filePath, settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.readFileBase64(filePath);
    }
    const response = await fetch(`${BASE_URL_API}/api/read-file-base64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    return await handleJsonResponse(response, 'Đọc file từ Cloud thất bại.');
  },

  compressAudio: async (inputPath, settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.compressAudio(inputPath);
    }
    const response = await fetch(`${BASE_URL_API}/api/compress-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputPath }),
    });
    return await handleJsonResponse(response, 'Nén âm thanh từ Cloud thất bại.');
  },

  ttsRequest: async (url, options = {}, settings) => {
    if (!shouldCallCloud(settings)) {
      return await window.electron.ttsRequest(url, options);
    }
    const response = await fetch(`${BASE_URL_API}/api/tts-request`, {
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

  saveTempAudio: async (audioBlobOrBuffer, settings) => {
    if (!shouldCallCloud(settings)) {
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
    const response = await fetch(`${BASE_URL_API}/api/video/upload-audio-segment`, {
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
