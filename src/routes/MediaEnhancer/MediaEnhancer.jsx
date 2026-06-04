import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Slider,
  Switch,
  Segmented,
  Row,
  Col,
  Divider,
  Tag,
  message,
  Typography,
  Progress,
} from 'antd';
import {
  Sparkles,
  UploadCloud,
  FileImage,
  Video,
  FolderOpen,
  Settings,
  Trash2,
  ListRestart,
  Sliders,
  Cpu,
} from 'lucide-react';
import './MediaEnhancerStyles.scss';

const { Title, Text } = Typography;

const MediaEnhancer = () => {
  const [selectedFile, setSelectedFile] = useState(null); // { name, path, type, size }
  const [loading, setLoading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [enhancedFile, setEnhancedFile] = useState(null); // holds absolute path of enhanced file
  const [previewMode, setPreviewMode] = useState('original'); // 'original' | 'enhanced'
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState(() => {
    return JSON.parse(localStorage.getItem('media_enhance_history') || '[]');
  });

  // Enhancement options
  const [options, setOptions] = useState({
    sharpenAmount: 1.2, // 0.0 to 2.0 (default 1.2 is extremely crisp)
    denoise: 0.0, // 0.0 to 2.0 (0.0 means OFF by default to preserve raw details)
    resolution: 'original', // 'original' | '1080p' | '2k' | '4k'
    scale: 1.0,
    contrast: 1.05,
    brightness: 0.0,
    saturation: 1.05,
  });

  useEffect(() => {
    localStorage.setItem('media_enhance_history', JSON.stringify(history));
  }, [history]);

  const addLog = (messageText, type = 'process') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, text: messageText, type }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleSelectFile = async (typeFilter) => {
    if (window.electron && !window.electron.isWebMock) {
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

    if (window.electron && !window.electron.isWebMock) {
      try {
        // Step 1: Check environment
        addLog('Đang kiểm tra môi trường xử lý (FFmpeg)...', 'process');
        const env = await window.electron.checkEnv();
        if (!env.ffmpeg) {
          throw new Error('Không tìm thấy FFmpeg trong hệ thống của bạn.');
        }
        setPercent(30);

        // Step 2: Processing options log
        addLog(
          `Thông số làm nét:
- Độ sắc nét: ${options.sharpenAmount}
- Khử nhiễu: ${options.denoise === 0 ? 'Tắt' : `${options.denoise.toFixed(1)}x`}
- Độ phân giải: ${options.resolution.toUpperCase()}
- Tương phản: ${options.contrast}
- Độ sáng: ${options.brightness}
- Độ bão hòa: ${options.saturation}`,
          'process'
        );

        addLog('Đang tiến hành kết xuất và tối ưu hóa chất lượng bằng bộ lọc FFmpeg...', 'process');
        setPercent(50);

        // Step 3: Run Enhancement
        const result = await window.electron.mediaEnhance(
          selectedFile.path,
          selectedFile.type,
          options
        );

        if (!result.ok) {
          throw new Error(result.error || 'Quá trình làm nét thất bại.');
        }

        setPercent(100);
        addLog(`Hoàn tất thành công! Tập tin được lưu tại: ${result.path}`, 'success');
        message.success('Làm nét ảnh/video thành công!');

        // Update preview to enhanced
        setEnhancedFile(result.path);
        setPreviewMode('enhanced');

        // Add to history
        const newHistoryItem = {
          id: Date.now(),
          name: selectedFile.name,
          type: selectedFile.type,
          inputPath: selectedFile.path,
          outputPath: result.path,
          time: new Date().toLocaleString(),
        };
        setHistory((prev) => [newHistoryItem, ...prev]);
      } catch (error) {
        addLog(`Lỗi: ${error.message}`, 'error');
        message.error(error.message);
        setPercent(0);
      } finally {
        setLoading(false);
      }
    } else {
      // Browser Cloud Path
      try {
        if (!selectedFile.fileObject) {
          throw new Error('Không tìm thấy file để tải lên.');
        }
        setPercent(20);
        addLog('Đang gửi tệp tin lên Cloud Server...', 'process');

        const formData = new FormData();
        formData.append('file', selectedFile.fileObject);
        formData.append('type', selectedFile.type);
        formData.append('options', JSON.stringify(options));

        setPercent(40);
        addLog('Đang xử lý làm nét phương tiện trên Cloud Server (FFmpeg)...', 'process');

        const response = await fetch('/api/media-enhance', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Server xử lý thất bại.');
        }

        const result = await response.json();
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
      } catch (error) {
        addLog(`Lỗi Cloud: ${error.message}`, 'error');
        message.error(error.message);
        setPercent(0);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteHistory = (id) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    message.success('Đã xóa lịch sử.');
  };

  const handleOpenFolder = (filePath) => {
    if (window.electron && !window.electron.isWebMock) {
      window.electron.showItemInFolder(filePath);
      message.success('Đã mở thư mục chứa tệp!');
    } else {
      window.open(filePath, '_blank');
    }
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
    if (previewMode === 'enhanced' && enhancedFile) {
      if (window.electron && !window.electron.isWebMock) {
        return `media://${enhancedFile.replace(/\\/g, '/')}`;
      }
      return enhancedFile;
    }
    if (selectedFile) {
      if (window.electron && !window.electron.isWebMock) {
        return `media://${selectedFile.path.replace(/\\/g, '/')}`;
      }
      return selectedFile.path;
    }
    return '';
  };

  return (
    <div className="tool-container media-enhancer-container">
      <Card variant="borderless" className="tool-card">
        <header className="tool-header">
          <h1 className="tool-gradient-title">AI Media Enhancer</h1>
          <div className="tool-status-bar">
            <Sparkles size={18} style={{ color: '#f59e0b' }} />
            <span>Làm nét ảnh và video chất lượng cao</span>
            <Divider type="vertical" />
            <Tag color="purple" bordered={false} style={{ borderRadius: '6px', fontWeight: 600 }}>
              v1.1.0
            </Tag>
          </div>
        </header>

        <Row gutter={[32, 32]}>
          {/* Main settings column */}
          <Col xs={24} lg={15} className="enhancer-main-section">
            <div className="section-label">
              <UploadCloud size={18} /> Tải lên Ảnh hoặc Video
            </div>

            {!selectedFile ? (
              <div className="upload-area" onClick={() => handleSelectFile('all')}>
                <UploadCloud size={48} />
                <div className="upload-title">Nhấp để chọn Ảnh / Video từ máy tính</div>
                <div className="upload-desc">
                  Hỗ trợ định dạng hình ảnh (PNG, JPG, WEBP, BMP) và video (MP4, MKV, AVI, MOV,
                  WEBM)
                </div>
              </div>
            ) : (
              <div className="file-preview-card">
                <div className="preview-header">
                  <span className="file-name">{selectedFile.name}</span>
                  <Button
                    type="text"
                    danger
                    icon={<Trash2 size={16} />}
                    onClick={() => {
                      setSelectedFile(null);
                      setEnhancedFile(null);
                      setPreviewMode('original');
                    }}
                  >
                    Xóa
                  </Button>
                </div>

                {enhancedFile && (
                  <div
                    className="preview-selector-wrapper"
                    style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}
                  >
                    <Segmented
                      value={previewMode}
                      onChange={(val) => setPreviewMode(val)}
                      options={[
                        {
                          label: (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '0 8px',
                              }}
                            >
                              {selectedFile.type === 'image' ? 'Ảnh Gốc' : 'Video Gốc'}
                            </span>
                          ),
                          value: 'original',
                        },
                        {
                          label: (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '0 8px',
                                color: '#10b981',
                                fontWeight: 700,
                              }}
                            >
                              <Sparkles size={14} />
                              Đã Làm Nét ✨
                            </span>
                          ),
                          value: 'enhanced',
                        },
                      ]}
                      className="custom-segmented preview-segmented"
                      disabled={loading}
                    />
                  </div>
                )}

                <div className="media-element-wrapper">
                  {selectedFile.type === 'image' ? (
                    <img key={previewMode} src={getPreviewUrl()} alt="Preview" />
                  ) : (
                    <video
                      key={previewMode}
                      src={getPreviewUrl()}
                      controls
                      autoPlay={previewMode === 'enhanced'}
                    />
                  )}
                </div>

                <div className="file-details">
                  <span className="detail-item">
                    Định dạng: {selectedFile.extension.toUpperCase()}
                  </span>
                  <span className="detail-item">
                    Kiểu: {selectedFile.type === 'image' ? 'Hình ảnh' : 'Video'}
                  </span>
                  <span className="detail-item">
                    Đường dẫn:{' '}
                    {previewMode === 'enhanced' && enhancedFile ? enhancedFile : selectedFile.path}
                  </span>
                </div>
              </div>
            )}

            <Divider style={{ margin: '24px 0' }} />

            <div className="section-label">
              <Sliders size={18} /> Tùy chỉnh bộ lọc làm nét
            </div>

            <div className="settings-grid">
              <Row gutter={[24, 24]}>
                <Col span={24}>
                  <div className="enhance-option-box">
                    <div className="option-header">
                      <span className="option-title">Độ sắc nét</span>
                      <span className="option-value">{options.sharpenAmount.toFixed(1)}</span>
                    </div>
                    <Slider
                      min={0.0}
                      max={2.0}
                      step={0.1}
                      value={options.sharpenAmount}
                      onChange={(val) => setOptions({ ...options, sharpenAmount: val })}
                      className="custom-slider"
                      disabled={loading}
                    />
                  </div>
                </Col>

                <Col span={24}>
                  <div className="enhance-option-box">
                    <div className="option-header">
                      <span className="option-title">Độ phân giải đầu ra (Super Resolution)</span>
                    </div>
                    <Segmented
                      block
                      value={options.resolution}
                      onChange={handleResolutionChange}
                      options={[
                        { label: 'Gốc', value: 'original' },
                        { label: '1080p', value: '1080p' },
                        { label: '2K', value: '2k' },
                        { label: '4K', value: '4k' },
                      ]}
                      className="custom-segmented"
                      disabled={loading}
                    />
                  </div>
                </Col>

                <Col xs={24} md={12}>
                  <div className="enhance-option-box">
                    <div className="option-header">
                      <span
                        className="option-title"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Cpu size={16} style={{ color: '#6366f1' }} />
                        Khử nhiễu
                      </span>
                      <span className="option-value">
                        {options.denoise === 0.0 ? 'Tắt' : `${options.denoise.toFixed(1)}x`}
                      </span>
                    </div>
                    <Slider
                      min={0.0}
                      max={2.0}
                      step={0.1}
                      value={options.denoise}
                      onChange={(val) => setOptions({ ...options, denoise: val })}
                      className="custom-slider"
                      disabled={loading}
                    />
                  </div>
                </Col>

                <Col xs={24} md={12}>
                  <div className="enhance-option-box">
                    <div className="option-header">
                      <span className="option-title">Độ tương phản</span>
                      <span className="option-value">{options.contrast.toFixed(2)}</span>
                    </div>
                    <Slider
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={options.contrast}
                      onChange={(val) => setOptions({ ...options, contrast: val })}
                      className="custom-slider"
                      disabled={loading}
                    />
                  </div>
                </Col>

                <Col xs={24} md={12}>
                  <div className="enhance-option-box">
                    <div className="option-header">
                      <span className="option-title">Độ sáng</span>
                      <span className="option-value">
                        {(options.brightness >= 0 ? '+' : '') + options.brightness.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      min={-0.3}
                      max={0.3}
                      step={0.02}
                      value={options.brightness}
                      onChange={(val) => setOptions({ ...options, brightness: val })}
                      className="custom-slider"
                      disabled={loading}
                    />
                  </div>
                </Col>

                <Col xs={24} md={12}>
                  <div className="enhance-option-box">
                    <div className="option-header">
                      <span className="option-title">Độ bão hòa màu</span>
                      <span className="option-value">{options.saturation.toFixed(2)}</span>
                    </div>
                    <Slider
                      min={0.5}
                      max={2.0}
                      step={0.05}
                      value={options.saturation}
                      onChange={(val) => setOptions({ ...options, saturation: val })}
                      className="custom-slider"
                      disabled={loading}
                    />
                  </div>
                </Col>
              </Row>
            </div>

            {loading && (
              <div className="progress-section">
                <div className="progress-label">
                  <span>Tiến trình kết xuất FFmpeg</span>
                  <span>{percent}%</span>
                </div>
                <Progress percent={percent} showInfo={false} strokeColor="var(--primary)" />
              </div>
            )}

            <div className="action-footer">
              <Button
                type="primary"
                size="large"
                loading={loading}
                disabled={!selectedFile}
                onClick={handleEnhance}
                className="enhance-btn"
                icon={!loading && <Sparkles size={20} />}
              >
                {loading ? 'ĐANG XỬ LÝ...' : 'BẮT ĐẦU LÀM NÉT'}
              </Button>
            </div>
          </Col>

          {/* Sidebar logs / history column */}
          <Col xs={24} lg={9}>
            <div className="section-label">
              <Settings size={18} /> Trạng thái xử lý
            </div>

            <Card variant="borderless" className="logs-card-inner">
              <div className="logs-container">
                {logs.length === 0 ? (
                  <div className="empty-logs">Chưa có hoạt động xử lý nào.</div>
                ) : (
                  logs.map((log, index) => {
                    const isSuccessPath =
                      log.type === 'success' && log.text.includes('Tập tin được lưu tại:');
                    let displayContent = log.text;
                    let path = '';
                    if (isSuccessPath) {
                      const parts = log.text.split('Tập tin được lưu tại:');
                      displayContent = parts[0] + 'Tập tin được lưu tại: ';
                      path = parts[1].trim();
                    }

                    return (
                      <div
                        key={index}
                        className={`log-item ${log.type} ${isSuccessPath ? 'clickable-log' : ''}`}
                        onClick={isSuccessPath ? () => handleOpenFolder(path) : undefined}
                      >
                        <span className="log-time">[{log.time}]</span>
                        {displayContent}
                        {isSuccessPath && (
                          <span
                            style={{
                              color: '#10b981',
                              textDecoration: 'underline',
                              fontWeight: 600,
                              wordBreak: 'break-all',
                              display: 'inline',
                            }}
                          >
                            {path}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Divider style={{ margin: '24px 0' }} />

            <div className="section-label">
              <FolderOpen size={18} /> Lịch sử xuất tệp
            </div>

            <Card variant="borderless" className="history-card-inner">
              <div className="history-container">
                {history.length === 0 ? (
                  <div className="empty-history">Chưa có lịch sử làm nét.</div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="history-item clickable-history-item"
                      onClick={() => handleSelectHistoryItem(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="history-header">
                        <span className="history-time">{item.time}</span>
                        <span className="history-type">
                          {item.type === 'image' ? (
                            <>
                              <FileImage size={12} /> Ảnh
                            </>
                          ) : (
                            <>
                              <Video size={12} /> Video
                            </>
                          )}
                        </span>
                      </div>
                      <div className="history-path" title={item.outputPath}>
                        {item.name}
                      </div>
                      <div className="history-actions">
                        <Button
                          type="text"
                          icon={<FolderOpen size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFolder(item.outputPath);
                          }}
                        >
                          Mở thư mục
                        </Button>
                        <Button
                          type="text"
                          danger
                          icon={<Trash2 size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistory(item.id);
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default MediaEnhancer;
