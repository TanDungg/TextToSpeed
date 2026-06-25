// src/_hook/useMediaEnhancer.js
import { useState, useEffect } from 'react';
import { message } from 'antd';
import MediaEnhancerService from '../_service/mediaEnhancer.service';

export const useMediaEnhancer = (settings) => {
  const [selectedFile, setSelectedFile] = useState(null); // { name, path, type, size, extension, fileObject }
  const [loading, setLoading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [enhancedFile, setEnhancedFile] = useState(null); // holds path/url of enhanced file
  const [previewMode, setPreviewMode] = useState('original'); // 'original' | 'enhanced'
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState(() => {
    return JSON.parse(localStorage.getItem('media_enhance_history') || '[]');
  });

  // Enhancement options
  const [options, setOptions] = useState({
    sharpenAmount: 1.2,
    sharpenMethod: 'unsharp', // 'cas' | 'unsharp'
    denoise: 0.0,
    denoiseMethod: 'none', // 'bilateral' | 'hqdn3d' | 'none'
    resolution: 'original',
    scale: 1.0,
    contrast: 1.05,
    brightness: 0.0,
    saturation: 1.05,
    useLocalAI: true,
    aiModel: 'realesr-animevideov3',
  });

  useEffect(() => {
    localStorage.setItem('media_enhance_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const isElectron = window.electron && !window.electron.isWebMock;
    if (isElectron && window.electron.on) {
      const unsubscribe = window.electron.on('media-enhance-progress', (data) => {
        if (data.text) addLog(data.text, data.type || 'process');
        if (data.percent !== undefined) setPercent(data.percent);
      });
      return unsubscribe;
    }
  }, []);

  const addLog = (messageText, type = 'process') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, text: messageText, type }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleSelectFile = async (typeFilter) => {
    const isElectron = window.electron && !window.electron.isWebMock;

    if (isElectron) {
      try {
        const res = await window.electron.selectFile(typeFilter);
        if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
          return;
        }

        const filePath = res.filePaths[0];
        const fileName = filePath.split(/[\\/]/).pop();
        const extension = fileName.split('.').pop().toLowerCase();

        const isImg = ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(extension);
        const isVid = ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(extension);

        if (!isImg && !isVid) {
          message.error('Định dạng tập tin không được hỗ trợ.');
          return;
        }

        setSelectedFile({
          name: fileName,
          path: filePath,
          type: isImg ? 'image' : 'video',
          extension: extension,
        });
        setEnhancedFile(null);
        setPreviewMode('original');

        addLog(`Đã chọn tập tin: ${fileName}`, 'success');
        message.success('Đã tải tập tin thành công!');
      } catch (error) {
        message.error('Không thể chọn tập tin: ' + error.message);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      if (typeFilter === 'video') {
        input.accept = 'video/*';
      } else if (typeFilter === 'image') {
        input.accept = 'image/*';
      } else {
        input.accept = 'video/*,image/*';
      }

      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = file.name;
        const extension = fileName.split('.').pop().toLowerCase();
        const isImg = ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(extension);
        const isVid = ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(extension);

        if (!isImg && !isVid) {
          message.error('Định dạng tập tin không được hỗ trợ.');
          return;
        }

        setSelectedFile({
          name: fileName,
          path: URL.createObjectURL(file),
          type: isImg ? 'image' : 'video',
          extension: extension,
          fileObject: file,
        });
        setEnhancedFile(null);
        setPreviewMode('original');

        addLog(`Đã chọn tập tin: ${fileName}`, 'success');
        message.success('Đã tải tập tin thành công!');
      };
      input.click();
    }
  };

  const handleResolutionChange = (val) => {
    let newOptions = { ...options, resolution: val };

    if (val === 'original') {
      newOptions.sharpenAmount = 1.2;
      newOptions.denoise = 0.0;
      newOptions.contrast = 1.05;
      newOptions.brightness = 0.0;
      newOptions.saturation = 1.05;
    } else if (val === '1080p') {
      newOptions.sharpenAmount = 1.2;
      newOptions.denoise = 0.1;
      newOptions.contrast = 1.05;
      newOptions.brightness = 0.0;
      newOptions.saturation = 1.05;
    } else if (val === '2k') {
      newOptions.sharpenAmount = 1.4;
      newOptions.denoise = 0.2;
      newOptions.contrast = 1.08;
      newOptions.brightness = 0.0;
      newOptions.saturation = 1.08;
    } else if (val === '4k') {
      newOptions.sharpenAmount = 1.6;
      newOptions.denoise = 0.3;
      newOptions.contrast = 1.1;
      newOptions.brightness = 0.0;
      newOptions.saturation = 1.1;
    }

    setOptions(newOptions);
    message.info(`Đã tự động áp dụng cấu hình tối ưu cho độ phân giải ${val.toUpperCase()}!`);
  };

  const handleEnhance = async () => {
    if (!selectedFile) {
      message.warning('Vui lòng chọn ảnh hoặc video trước!');
      return;
    }

    setLoading(true);
    setPercent(10);
    clearLogs();
    addLog('Bắt đầu quy trình làm nét...', 'process');

    const isElectron = window.electron && !window.electron.isWebMock;

    const falKey = settings?.falKey || JSON.parse(localStorage.getItem('tts_settings') || '{}').falKey || '';
    const enhancedOptions = { ...options, falKey };

    try {
      if (isElectron) {
        addLog('Khởi tạo quy trình nâng cấp chất lượng bằng AI Local...', 'process');
        setPercent(15);

        const result = await MediaEnhancerService.mediaEnhance(
          selectedFile.path,
          selectedFile.type,
          enhancedOptions
        );

        if (!result.ok) {
          throw new Error(result.error || 'Quá trình làm nét thất bại.');
        }

        setPercent(100);
        addLog(`Hoàn tất thành công! Tập tin được lưu tại: ${result.path}`, 'success');
        message.success('Làm nét ảnh/video thành công!');

        setEnhancedFile(result.path);
        setPreviewMode('enhanced');

        const newHistoryItem = {
          id: Date.now(),
          name: selectedFile.name,
          type: selectedFile.type,
          inputPath: selectedFile.path,
          outputPath: result.path,
          time: new Date().toLocaleString(),
        };
        setHistory((prev) => [newHistoryItem, ...prev]);
      } else {
        // Browser Cloud Path
        if (!selectedFile.fileObject) {
          throw new Error('Không tìm thấy file để tải lên.');
        }
        setPercent(20);
        addLog('Đang gửi tệp tin lên Cloud Server...', 'process');

        setPercent(40);
        addLog('Đang xử lý làm nét phương tiện trên Cloud Server (FFmpeg)...', 'process');

        const result = await MediaEnhancerService.mediaEnhance(
          selectedFile.fileObject,
          selectedFile.type,
          enhancedOptions
        );

        if (!result.ok) {
          throw new Error(result.error || 'Quá trình làm nét thất bại.');
        }

        setPercent(100);
        addLog('Hoàn tất thành công trên Cloud Server!', 'success');
        message.success('Làm nét ảnh/video thành công!');

        setEnhancedFile(result.url);
        setPreviewMode('enhanced');

        const newHistoryItem = {
          id: Date.now(),
          name: selectedFile.name,
          type: selectedFile.type,
          inputPath: selectedFile.path,
          outputPath: result.url,
          time: new Date().toLocaleString(),
        };
        setHistory((prev) => [newHistoryItem, ...prev]);
      }
    } catch (error) {
      addLog(`Lỗi: ${error.message}`, 'error');
      message.error(error.message);
      setPercent(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHistory = (id) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    message.success('Đã xóa lịch sử.');
  };

  const handleOpenFolder = (filePath) => {
    MediaEnhancerService.showItemInFolder(filePath);
  };

  const handleSelectHistoryItem = (item) => {
    const extension = item.name.split('.').pop().toLowerCase();
    setSelectedFile({
      name: item.name,
      path: item.inputPath,
      type: item.type,
      extension: extension,
    });
    setEnhancedFile(item.outputPath);
    setPreviewMode('enhanced');
    addLog(`Đã tải lại tệp từ lịch sử: ${item.name}`, 'success');
  };

  const getPreviewUrl = () => {
    const isElectron = window.electron && !window.electron.isWebMock;
    if (previewMode === 'enhanced' && enhancedFile) {
      if (isElectron) {
        return `media://${enhancedFile.replace(/\\/g, '/')}`;
      }
      return enhancedFile;
    }
    if (selectedFile) {
      if (isElectron) {
        return `media://${selectedFile.path.replace(/\\/g, '/')}`;
      }
      return selectedFile.path;
    }
    return '';
  };

  return {
    selectedFile,
    setSelectedFile,
    loading,
    percent,
    enhancedFile,
    setEnhancedFile,
    previewMode,
    setPreviewMode,
    logs,
    options,
    setOptions,
    history,
    handleSelectFile,
    handleResolutionChange,
    handleEnhance,
    handleDeleteHistory,
    handleOpenFolder,
    handleSelectHistoryItem,
    getPreviewUrl,
  };
};

export default useMediaEnhancer;
