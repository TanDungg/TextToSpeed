// src/helpers/electronPolyfill.js
if (typeof window !== 'undefined' && !window.electron) {
  window.electron = {
    isWebMock: true,

    checkEnv: async () => {
      try {
        const res = await fetch('/api/check-env');
        return await res.json();
      } catch {
        return { ffmpeg: false, ytdlp: false };
      }
    },

    videoDownload: async (url) => {
      const response = await fetch('/api/video-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Tải video từ Cloud thất bại.' };
      }
      return await response.json();
    },

    videoRemake: async (videoPath, options) => {
      const response = await fetch('/api/video-remake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath, options: typeof options === 'string' ? options : JSON.stringify(options) }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Lách video thất bại trên Cloud.' };
      }
      return await response.json();
    },

    extractAudio: async (videoPath) => {
      const response = await fetch('/api/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Trích xuất âm thanh từ Cloud thất bại.' };
      }
      return await response.json();
    },

    transcribeAudio: async (audioPath, apiKey) => {
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath, apiKey }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Nhận diện giọng nói từ Cloud thất bại.' };
      }
      return await response.json();
    },

    readFileBase64: async (filePath) => {
      const response = await fetch('/api/read-file-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Đọc file từ Cloud thất bại.' };
      }
      return await response.json();
    },

    ttsRequest: async (url, options = {}) => {
      const response = await fetch('/api/tts-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options }),
      });
      if (!response.ok) {
        const err = await response.json();
        return { ok: false, error: err.error || 'Yêu cầu Proxy thất bại.' };
      }
      const result = await response.json();
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

    saveTempAudio: async (buffer) => {
      const blob = new Blob([buffer], { type: 'audio/mpeg' });
      const formData = new FormData();
      formData.append('file', blob, `voice-${Date.now()}.mp3`);
      const response = await fetch('/api/save-temp-audio', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Không thể lưu file âm thanh tạm thời trên Cloud.');
      }
      const uploadData = await response.json();
      return uploadData.path;
    },

    showItemInFolder: (filePath) => {
      console.log('Mở thư mục chứa file:', filePath);
    },
  };
}
