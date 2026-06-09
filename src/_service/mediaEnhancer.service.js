// src/_service/mediaEnhancer.service.js
const isElectronEnv = () => window.electron && !window.electron.isWebMock;

export const MediaEnhancerService = {
  checkEnv: async () => {
    if (isElectronEnv()) {
      return await window.electron.checkEnv();
    }
    return { ffmpeg: true }; // Assume browser API has ffmpeg or it's handled server-side
  },

  mediaEnhance: async (fileOrPath, type, options) => {
    const isElectron = isElectronEnv();

    if (isElectron) {
      return await window.electron.mediaEnhance(fileOrPath, type, options);
    } else {
      // Browser Cloud Path
      if (!fileOrPath) {
        throw new Error('Không tìm thấy file để tải lên.');
      }
      const formData = new FormData();
      formData.append('file', fileOrPath);
      formData.append('type', type);
      formData.append('options', JSON.stringify(options));

      const response = await fetch('/api/media-enhance', {
        method: 'POST',
        body: formData,
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(`Lỗi hệ thống (${response.status}): Phản hồi từ máy chủ không hợp lệ.`);
      }

      if (!response.ok) {
        throw new Error(result.error || 'Server xử lý thất bại.');
      }

      return result;
    }
  },

  showItemInFolder: (filePath) => {
    if (isElectronEnv()) {
      window.electron.showItemInFolder(filePath);
    } else {
      window.open(filePath, '_blank');
    }
  }
};

export default MediaEnhancerService;
