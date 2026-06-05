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
} from 'antd';
import {
  DownloadCloud,
  Languages,
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
  } = useVideoRemaker(settings);

  return (
    <div className="tool-container video-remaker-container">
      <Card variant="borderless" className="tool-card">
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
              <div className="section-label">
                <DownloadCloud size={18} />
                <span>Link Video Gốc</span>
              </div>
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
                        ]}
                        className="custom-select"
                      />
                    </div>
                    <Checkbox
                      checked={options.flip}
                      onChange={(e) => setOptions({ ...options, flip: e.target.checked })}
                    >
                      Lật ngang video (Mirroring)
                    </Checkbox>
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
                      Hiệu ứng góc tối (Vignette)
                    </Checkbox>
                    <Checkbox
                      checked={options.audioPitch}
                      onChange={(e) => setOptions({ ...options, audioPitch: e.target.checked })}
                    >
                      Thay đổi âm thông (Audio Pitch 2%)
                    </Checkbox>
                    <Checkbox
                      checked={options.audioDelay}
                      onChange={(e) => setOptions({ ...options, audioDelay: e.target.checked })}
                    >
                      Độ trễ âm thanh & tiếng vang (Delay & Echo)
                    </Checkbox>
                  </div>
                </Col>
                <Col span={24}>
                  <div className="section-label">
                    <Languages size={18} />
                    <span>Dịch & Tốc độ</span>
                  </div>
                  <div className="translate-settings">
                    <Checkbox
                      checked={options.translate}
                      onChange={(e) => setOptions({ ...options, translate: e.target.checked })}
                      style={{ marginBottom: 16 }}
                    >
                      Dịch sang ngôn ngữ khác
                    </Checkbox>

                    {options.translate && (
                      <div className="translate-options-box">
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>
                            Ngôn ngữ đích
                          </p>
                          <Select
                            size="large"
                            value={options.targetLang}
                            style={{ width: '100%' }}
                            onChange={(val) => setOptions({ ...options, targetLang: val })}
                            options={[
                              { value: 'vi', label: 'Tiếng Việt' },
                              { value: 'en', label: 'Tiếng Anh' },
                              { value: 'zh', label: 'Tiếng Trung' },
                            ]}
                            className="custom-select"
                          />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <p style={{ marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>
                            Server Lồng tiếng
                          </p>
                          <Select
                            size="large"
                            value={options.ttsServer}
                            style={{ width: '100%' }}
                            onChange={(val) => {
                              let defaultVoice = 'vi-VN-HoaiMyNeural';
                              if (val === 'fpt') defaultVoice = 'banmai';
                              if (val === 'google-cloud') defaultVoice = 'vi-VN-Neural2-A';
                              setOptions({ ...options, ttsServer: val, ttsVoice: defaultVoice });
                            }}
                            options={[
                              { label: 'Edge TTS (Free - Khuyên dùng)', value: 'edge' },
                              { label: 'Google Dịch (Cơ bản)', value: 'google' },
                              { label: 'Google Cloud (Chuyên nghiệp)', value: 'google-cloud' },
                              { label: 'FPT.AI', value: 'fpt' },
                              { label: 'ElevenLabs', value: 'elevenlabs' },
                            ]}
                            className="custom-select"
                          />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <p style={{ marginBottom: 4, fontSize: 12, color: '#94a3b8' }}>
                            Giọng đọc lồng tiếng
                          </p>
                          <Select
                            size="large"
                            value={options.ttsVoice}
                            style={{ width: '100%' }}
                            onChange={(val) => setOptions({ ...options, ttsVoice: val })}
                            options={
                              options.ttsServer === 'edge'
                                ? [
                                    {
                                      label: 'Nữ - Hoài My (Edge)',
                                      value: 'vi-VN-HoaiMyNeural',
                                    },
                                    {
                                      label: 'Nam - Nam Minh (Edge)',
                                      value: 'vi-VN-NamMinhNeural',
                                    },
                                    {
                                      label: 'Nữ - Phương Mỹ (Edge)',
                                      value: 'vi-VN-PhuongMyNeural',
                                    },
                                    {
                                      label: 'Nam - Mạnh Khôi (Edge)',
                                      value: 'vi-VN-ManhKhoiNeural',
                                    },
                                  ]
                                : options.ttsServer === 'fpt'
                                  ? [
                                      { label: 'Nữ - Ban Mai (FPT)', value: 'banmai' },
                                      { label: 'Nam - Lê Minh (FPT)', value: 'leminh' },
                                      { label: 'Nữ - Thu Minh (FPT)', value: 'thuminh' },
                                      { label: 'Nữ - Gia Huy (FPT)', value: 'giahuy' },
                                    ]
                                  : options.ttsServer === 'google-cloud'
                                    ? [
                                        { label: 'Nữ - Neural2-A', value: 'vi-VN-Neural2-A' },
                                        { label: 'Nam - Neural2-B', value: 'vi-VN-Neural2-B' },
                                        { label: 'Nữ - Wavenet-A', value: 'vi-VN-Wavenet-A' },
                                        { label: 'Nam - Wavenet-B', value: 'vi-VN-Wavenet-B' },
                                      ]
                                    : [{ label: 'Mặc định', value: 'default' }]
                            }
                            className="custom-select"
                          />
                        </div>
                      </div>
                    )}

                    {options.translate && (
                      <div style={{ marginTop: 12, marginBottom: 16 }}>
                        <Checkbox
                          checked={options.reviewSrt}
                          onChange={(e) => setOptions({ ...options, reviewSrt: e.target.checked })}
                        >
                          Kiểm tra & Sửa phụ đề trước khi lồng tiếng
                        </Checkbox>
                      </div>
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
                          <span className="history-lang">
                            Dịch: {item.targetLang.toUpperCase()}
                          </span>
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
                              window.electron.showItemInFolder(item.outputPath);
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

              {(!envStatus.ffmpeg || !envStatus.ytdlp) && (
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
                    <p style={{ marginTop: 8, fontWeight: 500 }}>
                      Sau khi cài đặt, hãy thêm vào <b>PATH</b> hệ thống và khởi động lại ứng dụng.
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
            <span>Kiểm tra & Hiệu chỉnh Phụ đề Lồng tiếng</span>
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
          Dưới đây là phụ đề (định dạng SRT) đã được AI trích xuất và dịch từ video gốc. Bạn có thể
          chỉnh sửa lại bản dịch hoặc điều chỉnh mốc thời gian để khớp voice hoàn hảo nhất:
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
