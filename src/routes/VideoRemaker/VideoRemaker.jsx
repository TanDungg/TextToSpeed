import React, { useState, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Typography,
  message,
  Row,
  Col,
  Checkbox,
  Select,
  Progress,
  Tag,
  Divider,
  Modal,
  Segmented,
} from 'antd';
import {
  DownloadCloud,
  Settings2,
  Zap,
  Info,
  ExternalLink,
  History,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import './VideoRemakerStyles.scss';

import useVideoRemaker from '../../_hook/useVideoRemaker';
import VideoRemakerService from '../../_service/videoRemaker.service';

const { Title, Text } = Typography;

const VideoRemaker = ({ settings }) => {
  const isElectron = window.electron && !window.electron.isWebMock;
  const {
    url,
    setUrl,
    loading,
    status,
    setStatus,
    progress,
    setProgress,
    logs,
    options,
    setOptions,
    showSrtModal,
    setShowSrtModal,
    srtText,
    setSrtText,
    envStatus,
    history,
    setHistory,
    handleStart,
    getBasename,
    videoSource,
    setVideoSource,
    localFilePath,
    setLocalFilePath,
    handleSelectFile,
  } = useVideoRemaker(settings);

  const isProcessing = loading || ['downloading', 'translating', 'remaking'].includes(status);

  return (
    <div className="tool-container video-remaker-container">
      <Card variant="borderless" className="tool-card">
        {isProcessing && (
          <div className="tool-card-overlay">
            <div className="premium-spinner" />
            <div className="tool-card-overlay-text">
              {status === 'downloading'
                ? 'Đang tải video nguồn...'
                : status === 'translating'
                ? 'Đang phân tích âm thanh & trích xuất phụ đề AI...'
                : status === 'remaking'
                ? 'Đang tiến hành Remake lách bản quyền...'
                : 'Đang xử lý video...'}
            </div>
            <div className="tool-card-overlay-subtext">
              Hệ thống đang áp dụng các bộ lọc làm nhiễu Content ID & biến đổi tần số âm thanh. Vui lòng giữ ứng dụng mở.
            </div>
            <div className="overlay-progress-container">
              <Progress percent={progress} strokeColor="#0d9488" />
            </div>
          </div>
        )}
        <header className="tool-header">
          <h1 className="tool-gradient-title">Smart Video Remaker</h1>
          <div className="tool-status-bar">
            <Zap size={18} style={{ color: '#f59e0b' }} />
            <span>Tải video đa nền tảng & Lách bản quyền Shorts/TikTok</span>
            <Divider type="vertical" />
            <Tag color="blue" bordered={false} style={{ borderRadius: '6px', fontWeight: 600 }}>
              v1.0.0
            </Tag>
          </div>
        </header>

        <Row gutter={[32, 32]}>
          <Col xs={24} lg={15}>
            <div className="remaker-main-section">
              <div className="section-label" style={{ marginBottom: 12 }}>
                <DownloadCloud size={18} />
                <span>Nguồn Video Đầu Vào</span>
              </div>
              <Segmented
                block
                size="large"
                value={videoSource}
                onChange={(val) => {
                  setVideoSource(val);
                  if (status === 'done') {
                    setStatus('idle');
                    setProgress(0);
                  }
                }}
                options={[
                  { label: 'Dán Link Video', value: 'url' },
                  { label: 'Chọn File Từ Máy Tính', value: 'file' },
                ]}
                style={{ marginBottom: 20, borderRadius: '10px' }}
                className="custom-segmented"
              />

              {videoSource === 'url' ? (
                <Input
                  size="large"
                  placeholder="Dán link Youtube, Douyin, TikTok, Facebook vào đây..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (status === 'done') {
                      setStatus('idle');
                      setProgress(0);
                    }
                  }}
                  className="custom-input"
                  prefix={<ExternalLink size={16} color="#0d9488" />}
                  style={{ marginBottom: 32 }}
                />
              ) : (
                <div style={{ marginBottom: 32 }}>
                  {!localFilePath ? (
                    <div
                      onClick={handleSelectFile}
                      style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: '12px',
                        padding: '24px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: '#f8fafc',
                        transition: 'all 0.3s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0d9488';
                        e.currentTarget.style.background = '#f0fdfa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                    >
                      <DownloadCloud size={32} style={{ color: '#0d9488', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600, color: '#334155' }}>Nhấp để chọn video từ máy tính</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>Hỗ trợ MP4, MKV, AVI, MOV, WEBM</div>
                    </div>
                  ) : (
                    <div
                      style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '16px',
                        background: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                        <div style={{ background: 'rgba(13, 148, 136, 0.1)', padding: '8px', borderRadius: '8px', color: '#0d9488', flexShrink: 0 }}>
                          <ExternalLink size={20} />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, color: '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {getBasename(localFilePath)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={localFilePath}>
                            Đường dẫn: {localFilePath}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="text"
                        danger
                        icon={<Trash2 size={16} />}
                        onClick={() => setLocalFilePath('')}
                        style={{ flexShrink: 0 }}
                      >
                        Xóa
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Row gutter={[24, 24]}>
                <Col span={24}>
                  <div className="section-label">
                    <Settings2 size={18} />
                    <span>Lách bản quyền</span>
                  </div>
                  <div className="checkbox-group">
                    <div style={{ marginBottom: 8 }}>
                      <p
                        style={{ marginBottom: 6, fontSize: 13, color: '#475569', fontWeight: 600 }}
                      >
                        Cường độ lách bản quyền:
                      </p>
                      <Select
                        size="large"
                        value={options.remakeLevel || 'strong'}
                        style={{ width: '100%' }}
                        onChange={(val) => setOptions({ ...options, remakeLevel: val })}
                        options={[
                          { value: 'normal', label: 'Lách nhẹ (Phù hợp TikTok, Reels, Facebook)' },
                          { value: 'strong', label: 'Lách mạnh (Phù hợp YouTube Content ID)' },
                          { value: 'super_strong', label: 'Lách Siêu Cấp (Chuyên trị FIFA & Bản quyền cực gắt)' },
                        ]}
                        className="custom-select"
                      />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 24px', marginTop: '8px' }}>
                      <Checkbox
                        checked={options.colorShift}
                        onChange={(e) => setOptions({ ...options, colorShift: e.target.checked })}
                      >
                        Thay đổi hệ màu (Color Shift)
                      </Checkbox>
                      <Checkbox
                        checked={options.vignette}
                        onChange={(e) => setOptions({ ...options, vignette: e.target.checked })}
                      >
                        Góc tối (Vignette)
                      </Checkbox>
                      <Checkbox
                        checked={options.flip}
                        onChange={(e) => setOptions({ ...options, flip: e.target.checked })}
                      >
                        Lật ngang (Flip)
                      </Checkbox>
                      <Checkbox
                        checked={options.audioPitch}
                        onChange={(e) => setOptions({ ...options, audioPitch: e.target.checked })}
                      >
                        Biến đổi giọng (Pitch Shift)
                      </Checkbox>
                      <Checkbox
                        checked={options.audioDelay}
                        onChange={(e) => setOptions({ ...options, audioDelay: e.target.checked })}
                      >
                        Độ trễ & Vọng (Delay/Echo)
                      </Checkbox>

                      <Checkbox
                        checked={options.blurBorder}
                        onChange={(e) => setOptions({ ...options, blurBorder: e.target.checked })}
                      >
                        Khung viền mờ (Blur Border)
                      </Checkbox>
                    </div>
                  </div>
                </Col>
                <Col span={24}>
                  <div className="section-label">
                    <Settings2 size={18} />
                    <span>Xử lý Nhạc nền (BGM)</span>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <p
                      style={{ marginBottom: 6, fontSize: 13, color: '#475569', fontWeight: 600 }}
                    >
                      Chế độ nhạc nền:
                    </p>
                    <Select
                      size="large"
                      value={options.bgmMode || 'demucs'}
                      style={{ width: '100%' }}
                      onChange={(val) => setOptions({ ...options, bgmMode: val })}
                      options={[
                        { value: 'none', label: 'Bỏ nhạc nền (Chỉ giữ giọng thuyết minh mới)' },
                        { value: 'duck', label: 'Giảm volume nhạc nền gốc (-12dB)' },
                        { value: 'demucs', label: 'Tách nhạc nền sạch bằng AI Demucs (Khuyên dùng)' },
                      ]}
                      className="custom-select"
                    />
                  </div>
                </Col>
                <Col span={24}>
                  <div className="section-label">
                    <Settings2 size={18} />
                    <span>Trích xuất & Tốc độ video</span>
                  </div>
                  <div className="translate-settings">
                    <Checkbox
                      checked={options.transcribe}
                      onChange={(e) => setOptions({ ...options, transcribe: e.target.checked })}
                      style={{ marginBottom: 16 }}
                    >
                      Trích xuất âm thanh & văn bản (Chuyển giọng nói thành text)
                    </Checkbox>

                    {options.transcribe && (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <Checkbox
                            checked={options.reviewSrt}
                            onChange={(e) => setOptions({ ...options, reviewSrt: e.target.checked })}
                          >
                            Kiểm tra & Sửa phụ đề trước khi kết xuất
                          </Checkbox>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <p style={{ marginBottom: 6, fontSize: 13, color: '#475569', fontWeight: 600 }}>
                            Chế độ dịch thuật & lồng tiếng AI:
                          </p>
                          <Select
                            size="large"
                            value={options.usePremiumAI ? 'premium' : 'free'}
                            style={{ width: '100%' }}
                            onChange={(val) => setOptions({ ...options, usePremiumAI: val === 'premium' })}
                            options={[
                              { value: 'free', label: 'Miễn phí (Groq Whisper + Edge TTS)' },
                              { value: 'premium', label: 'Trả phí (OpenAI Whisper + OpenAI/FPT TTS - Độ chính xác cao)' },
                            ]}
                            className="custom-select"
                          />
                        </div>
                      </>
                    )}

                    <Select
                      size="large"
                      defaultValue={1.05}
                      style={{ width: '100%' }}
                      onChange={(val) => setOptions({ ...options, speed: val })}
                      options={[
                        { value: 1, label: 'Tốc độ: 1.0x (Gốc)' },
                        { value: 1.05, label: 'Tốc độ: 1.05x (Khuyên dùng)' },
                        { value: 1.1, label: 'Tốc độ: 1.1x' },
                      ]}
                      className="custom-select"
                    />
                  </div>
                </Col>
                
                <Col span={24}>
                  <div className="section-label">
                    <Settings2 size={18} />
                    <span>Cấu hình tự động đăng tải (Auto Publish)</span>
                  </div>
                  <div className="publish-settings" style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <Checkbox
                      checked={options.publishYoutube}
                      onChange={(e) => setOptions({ ...options, publishYoutube: e.target.checked })}
                    >
                      Đăng lên YouTube (OAuth2 Client Secrets)
                    </Checkbox>
                    <Checkbox
                      checked={options.publishFacebook}
                      onChange={(e) => setOptions({ ...options, publishFacebook: e.target.checked })}
                    >
                      Đăng lên Facebook (Fanpage Token)
                    </Checkbox>
                    <Checkbox
                      checked={options.publishTiktok}
                      onChange={(e) => setOptions({ ...options, publishTiktok: e.target.checked })}
                    >
                      Đăng lên TikTok (OAuth Access Token)
                    </Checkbox>
                  </div>
                </Col>
              </Row>

              <div className="action-footer" style={{ marginTop: 48 }}>
                <Button
                  type="primary"
                  size="large"
                  icon={!loading && <Zap size={18} />}
                  onClick={handleStart}
                  loading={loading}
                  className="process-btn"
                >
                  {loading ? 'Đang xử lý...' : 'Bắt đầu Remake Video'}
                </Button>
              </div>

              {(loading || status !== 'idle') && (
                <div className="progress-section">
                  <div className="progress-label">
                    <Text strong>
                      {status === 'downloading'
                        ? 'Đang tải...'
                        : status === 'remaking'
                          ? 'Đang remake...'
                          : 'Hoàn thành'}
                    </Text>
                    <Text>{progress}%</Text>
                  </div>
                  <Progress percent={progress} strokeColor="#0d9488" />
                </div>
              )}
            </div>
          </Col>

          <Col xs={24} lg={9}>
            <div className="remaker-sidebar">
              <Card
                className="logs-card-inner"
                title={
                  <div className="card-title">
                    <Info size={16} />
                    <span>Nhật ký xử lý</span>
                  </div>
                }
              >
                <div className="logs-container">
                  {logs.length === 0 ? (
                    <div className="empty-logs">Chưa có hoạt động nào.</div>
                  ) : (
                    logs.map((log, idx) => (
                      <div key={idx} className={`log-item ${log.type}`}>
                        <span className="log-time">[{log.time}]</span>
                        <span className="log-msg">{log.msg}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card
                className="history-card-inner"
                style={{ marginTop: 24 }}
                title={
                  <div className="card-title">
                    <History size={16} />
                    <span>Lịch sử Remake</span>
                  </div>
                }
              >
                <div className="history-container">
                  {history.length === 0 ? (
                    <div className="empty-history">Chưa có lịch sử remake.</div>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="history-item">
                        <div className="history-header">
                          <span className="history-time">{item.time}</span>
                          {item.targetLang && (
                            <span className="history-lang">
                              {item.targetLang === 'txt' ? 'Trích xuất' : `Dịch: ${item.targetLang.toUpperCase()}`}
                            </span>
                          )}
                        </div>
                        <div className="history-url" title={item.url}>
                          {item.url}
                        </div>
                        <div className="history-path" title={item.outputPath}>
                          Lưu: {getBasename(item.outputPath)}
                        </div>
                        <div className="history-actions">
                          <Button
                            type="text"
                            size="small"
                            icon={<ExternalLink size={12} />}
                            onClick={() => {
                              setUrl(item.url);
                              message.success('Đã nạp lại link video!');
                            }}
                          >
                            Dùng lại link
                          </Button>
                          <Button
                            type="text"
                            size="small"
                            icon={<FolderOpen size={12} />}
                            onClick={() => {
                              VideoRemakerService.showItemInFolder(item.outputPath);
                            }}
                          >
                            Mở thư mục
                          </Button>
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<Trash2 size={12} />}
                            onClick={() => {
                              setHistory((prev) => {
                                const updated = prev.filter((h) => h.id !== item.id);
                                localStorage.setItem(
                                  'video_remake_history',
                                  JSON.stringify(updated)
                                );
                                return updated;
                              });
                              message.success('Đã xóa lịch sử!');
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {isElectron && !settings?.useCloudEngine && (!envStatus.ffmpeg || !envStatus.ytdlp || !envStatus.demucs) && (
                <Card
                  className="warning-card-inner"
                  style={{ marginTop: 24, border: '1px solid #fee2e2', background: '#fef2f2' }}
                >
                  <Title level={5} style={{ color: '#dc2626' }}>
                    <Info size={16} /> Yêu cầu cài đặt
                  </Title>
                  <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
                    {!envStatus.ffmpeg && (
                      <p>
                        • <b>FFmpeg</b>: Cần thiết để remake video. Tải tại{' '}
                        <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer">
                          ffmpeg.org
                        </a>
                      </p>
                    )}
                    {!envStatus.ytdlp && (
                      <p>
                        • <b>yt-dlp</b>: Cần thiết để tải video. Tải tại{' '}
                        <a
                          href="https://github.com/yt-dlp/yt-dlp/releases"
                          target="_blank"
                          rel="noreferrer"
                        >
                          GitHub
                        </a>
                      </p>
                    )}
                    {!envStatus.demucs && (
                      <p>
                        • <b>Demucs</b>: Cần thiết để tách nhạc nền bằng AI. Hãy cài đặt Python và chạy lệnh <code>pip install demucs</code> trong Command Prompt.
                      </p>
                    )}
                    <p style={{ marginTop: 8, fontWeight: 500 }}>
                      Sau khi cài đặt, hãy thêm các công cụ vào <b>PATH</b> hệ thống và khởi động lại ứng dụng.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            <History size={20} color="#0d9488" />
            <span>Kiểm tra & Hiệu chỉnh Phụ đề</span>
          </div>
        }
        open={showSrtModal}
        onOk={() => {
          if (window.resolveSrtPromise) {
            window.resolveSrtPromise(srtText);
          }
          setShowSrtModal(false);
        }}
        onCancel={() => {
          if (window.rejectSrtPromise) {
            window.rejectSrtPromise(new Error('Đã hủy bởi người dùng.'));
          }

          setShowSrtModal(false);
        }}
        okText="Xác nhận & Tiếp tục Remake"
        cancelText="Hủy bỏ"
        width={700}
        maskClosable={false}
        destroyOnClose
      >
        <p style={{ color: '#64748b', marginBottom: 12 }}>
          Dưới đây là phụ đề (định dạng SRT) đã được AI trích xuất từ giọng nói gốc của video. Bạn có thể
          chỉnh sửa lại câu chữ hoặc điều chỉnh mốc thời gian để chuẩn xác nhất:
        </p>
        <Input.TextArea
          rows={16}
          value={srtText}
          onChange={(e) => setSrtText(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '13px', borderRadius: '12px' }}
          placeholder="1
00:00:01,000 --> 00:00:04,000
Xin chào các bạn..."
        />
      </Modal>
    </div>
  );
};

export default VideoRemaker;
