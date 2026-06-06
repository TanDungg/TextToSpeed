import React from 'react';
import useMediaEnhancer from '../../_hook/useMediaEnhancer';
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
  const {
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
  } = useMediaEnhancer();

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
              <Row gutter={[20, 20]}>
                {/* AI Model Selection */}
                <Col span={24}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={14} style={{ color: '#0d9488' }} />
                    Mô hình AI sử dụng:
                  </div>
                  <Segmented
                    block
                    value={options.aiModel || 'realesr-animevideov3'}
                    onChange={(val) => setOptions({ ...options, aiModel: val })}
                    options={[
                      { label: 'Tối ưu tốc độ (Video/Nhanh)', value: 'realesr-animevideov3' },
                      { label: 'Chất lượng cao (Ảnh/Chậm)', value: 'realesrgan-x4plus' },
                    ]}
                    className="custom-segmented"
                    disabled={loading}
                  />
                  <div
                    style={{
                      color: '#0d9488',
                      fontSize: '12px',
                      marginTop: '8px',
                      fontWeight: 500,
                    }}
                  >
                    ✓ Sử dụng mô hình AI Real-ESRGAN chạy bằng GPU của máy tính. Miễn phí & Không giới hạn!
                  </div>
                </Col>

                {/* Always show resolution */}
                <Col span={24}>
                  <Divider
                    plain
                    style={{ margin: '8px 0', fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}
                  >
                    ĐỘ PHÂN GIẢI ĐẦU RA
                  </Divider>
                  <div className="enhance-option-box" style={{ marginTop: '8px' }}>
                    <Segmented
                      block
                      value={options.resolution}
                      onChange={handleResolutionChange}
                      options={[
                        { label: 'Độ phân giải gốc', value: 'original' },
                        { label: '1080p Full HD', value: '1080p' },
                        { label: '2K Quad HD', value: '2k' },
                        { label: '4K Ultra HD', value: '4k' },
                      ]}
                      className="custom-segmented"
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
