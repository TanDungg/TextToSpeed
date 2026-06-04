import { useState } from 'react';
import { Card, Input, Button, Progress, message, Tag, Typography, Divider, Alert } from 'antd';
import {
  PlayCircleOutlined,
  SearchOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { Music, Radio, Sparkles } from 'lucide-react';
import './LofiHelperStyles.scss';

const { Text } = Typography;

const LofiHelper = ({ settings }) => {
  const isWeb = !window.electron || window.electron.isWebMock;
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [key, setKey] = useState('');
  const [bpm, setBpm] = useState('');
  const [targetBpm, setTargetBpm] = useState('');

  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [loadingBeats, setLoadingBeats] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [beatsList, setBeatsList] = useState([]);
  const [selectedBeat, setSelectedBeat] = useState(null);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);

  const addLog = (msg, type = 'process') => {
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), text: msg, type }]);
  };

  const handleFetchMetadata = async () => {
    if (isWeb) return;
    if (!url.trim()) {
      return message.warning('Vui lòng nhập đường dẫn liên kết bài hát!');
    }

    setLoadingMetadata(true);
    setTitle('');
    setKey('');
    setBpm('');
    setTargetBpm('');
    setBeatsList([]);
    setSelectedBeat(null);
    setLogs([]);
    setProgress(0);

    addLog('Đang phân tích thông tin liên kết...', 'process');

    try {
      const res = await window.electron.lofiSearchMetadata(url);
      if (res.ok) {
        setTitle(res.title);
        setDuration(res.duration);
        addLog(`Tìm thấy bài hát: "${res.title}" (${res.duration})`, 'success');

        // Bắt đầu nhận diện Key & BPM
        await detectKeyAndBpm(res.title);
      } else {
        throw new Error(res.error || 'Không thể lấy thông tin bài hát.');
      }
    } catch (err) {
      addLog(`Lỗi: ${err.message}`, 'error');
      message.error('Lỗi phân tích đường dẫn!');
    } finally {
      setLoadingMetadata(false);
    }
  };

  const detectKeyAndBpm = async (songTitle) => {
    addLog('Đang dự đoán tông nhạc (Key) và nhịp độ (BPM) bằng AI...', 'process');

    if (!settings.geminiKey) {
      addLog('Không tìm thấy Gemini API Key trong cài đặt. Đặt giá trị mặc định.', 'error');
      setKey('C Major');
      setBpm('100');
      setTargetBpm('75');
      return;
    }

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiKey}`;
      const prompt = `Identify the musical Key (e.g., A minor, C major, F# major) and original BPM (integer value) of the song: "${songTitle}". 
Return ONLY a valid JSON object in the exact format: {"key": "A minor", "bpm": 120}. Do not include markdown tags, code blocks, or extra text.`;

      const response = await window.electron.ttsRequest(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        },
      });

      if (response.ok && response.data) {
        const textResult = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        // Clean JSON formatting if Gemini wrapped it in markdown code blocks
        const cleanJson = textResult
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.key && parsed.bpm) {
          setKey(parsed.key);
          setBpm(parsed.bpm.toString());
          const originalBpm = parseInt(parsed.bpm, 10);
          const tBpm = originalBpm > 110 ? Math.round(originalBpm / 2) : originalBpm;
          setTargetBpm(tBpm.toString());

          addLog(`AI Nhận diện - Tông: ${parsed.key} | Nhịp gốc: ${parsed.bpm} BPM`, 'success');
          addLog(`Gợi ý nhịp độ Lofi tương thích: ${tBpm} BPM`, 'success');
        } else {
          throw new Error('Dữ liệu AI trả về không đúng cấu trúc.');
        }
      } else {
        throw new Error('Yêu cầu AI thất bại.');
      }
    } catch (err) {
      console.error(err);
      addLog('Dự đoán bằng AI gặp lỗi. Sử dụng giá trị mặc định.', 'error');
      setKey('C Major');
      setBpm('100');
      setTargetBpm('75');
    }
  };

  const handleSearchBeats = async () => {
    if (isWeb) return;
    if (!key || !targetBpm) {
      return message.warning('Vui lòng kiểm tra và nhập đầy đủ Tông (Key) và Nhịp độ Lofi (BPM)!');
    }

    setLoadingBeats(true);
    setBeatsList([]);
    setSelectedBeat(null);
    addLog(
      `Đang tìm kiếm các Lofi Beat phù hợp với Key "${key}" và nhịp độ ${targetBpm} BPM...`,
      'process'
    );

    try {
      const res = await window.electron.lofiSearchBeats(key, targetBpm);
      if (res.ok && res.results && res.results.length > 0) {
        setBeatsList(res.results);
        setSelectedBeat(res.results[0]);
        addLog(`Tìm thấy ${res.results.length} Lofi Beat phù hợp từ YouTube!`, 'success');
      } else {
        throw new Error(res.error || 'Không tìm thấy Beat nào.');
      }
    } catch (err) {
      addLog(`Lỗi tìm kiếm Beat: ${err.message}`, 'error');
      message.error('Không thể tìm thấy Lofi Beat phù hợp.');
    } finally {
      setLoadingBeats(false);
    }
  };

  const handleDownloadPackage = async () => {
    if (isWeb) return;
    if (!selectedBeat) {
      return message.warning('Vui lòng chọn một Lofi Beat từ danh sách trước!');
    }

    setDownloading(true);
    setProgress(10);
    addLog('Bắt đầu tải gói chuẩn bị Remix...', 'process');
    addLog(`Tải Nhạc Gốc từ liên kết ban đầu...`, 'process');

    try {
      setProgress(30);
      const res = await window.electron.lofiDownloadPair(url, selectedBeat.url, title);
      setProgress(100);

      if (res.ok) {
        addLog('Đã tải thành công trọn bộ!', 'success');
        addLog(
          `Gói Remix được lưu tại: Downloads/LofiHelper/${title.replace(/[/\\?%*:|"<>]/g, '-').trim()}`,
          'success'
        );
        message.success('Tải trọn bộ thành công!');
      } else {
        throw new Error(res.error || 'Tải file gặp lỗi.');
      }
    } catch (err) {
      addLog(`Lỗi tải xuống: ${err.message}`, 'error');
      message.error('Tải gói nhạc thất bại.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="tool-container lofi-helper-container">
      <Card variant="borderless" className="tool-card">
        <header className="tool-header">
          <h1 className="tool-gradient-title">Lofi Remix Helper</h1>
          <div className="tool-status-bar">
            <Sparkles size={18} style={{ color: '#f59e0b' }} />
            <span>Chuẩn bị dữ liệu và tìm beat phù hợp cho FL Studio</span>
            <Divider type="vertical" />
            <Tag color="purple" bordered={false} style={{ borderRadius: '6px', fontWeight: 600 }}>
              Alpha v1.0
            </Tag>
          </div>
        </header>

        <div className="lofi-layout">
          {/* Main Panel */}
          <div className="lofi-main-content">
            {isWeb && (
              <Alert
                message="Lưu ý: Tính năng Lofi Remix Helper yêu cầu ứng dụng chạy trên Electron Desktop để tự động tải xuống và đồng bộ hóa thư mục dự án cục bộ cho FL Studio."
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}
            <div className="input-section" style={{ display: 'flex', gap: '8px' }}>
              <Input
                placeholder="Nhập đường dẫn bài hát YouTube, MP3..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="custom-input"
                style={{ flex: 1 }}
                disabled={loadingMetadata || downloading || isWeb}
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleFetchMetadata}
                loading={loadingMetadata}
                disabled={downloading || isWeb}
                className="action-btn search-beats-btn"
              >
                Phân tích
              </Button>
            </div>

            {title && (
              <div className="metadata-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Music size={18} style={{ color: 'var(--primary)' }} />
                  <Text strong style={{ fontSize: '1.05rem', color: '#1e293b' }}>
                    {title}
                  </Text>
                </div>

                <div className="key-bpm-row">
                  <div className="key-input">
                    <label>Tông nhạc gốc (Key)</label>
                    <Input
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      className="custom-input"
                      disabled={downloading}
                    />
                  </div>
                  <div className="bpm-input">
                    <label>Nhịp độ gốc (BPM)</label>
                    <Input
                      value={bpm}
                      onChange={(e) => setBpm(e.target.value)}
                      className="custom-input"
                      disabled={downloading}
                    />
                  </div>
                  <div className="bpm-input">
                    <label>Gợi ý nhịp Lofi (BPM)</label>
                    <Input
                      value={targetBpm}
                      onChange={(e) => setTargetBpm(e.target.value)}
                      className="custom-input"
                      disabled={downloading}
                    />
                  </div>
                </div>

                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={handleSearchBeats}
                  loading={loadingBeats}
                  disabled={downloading}
                  className="action-btn search-beats-btn"
                  style={{ marginTop: '4px' }}
                >
                  Tìm kiếm Lofi Beat phù hợp
                </Button>
              </div>
            )}

            {beatsList.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Text strong style={{ fontSize: '0.95rem', color: '#475569' }}>
                  Chọn Lofi Beat ưng ý từ YouTube:
                </Text>
                <div className="beat-cards-grid">
                  {beatsList.map((beat) => (
                    <div
                      key={beat.id}
                      className={`beat-card ${selectedBeat?.id === beat.id ? 'selected' : ''}`}
                      onClick={() => setSelectedBeat(beat)}
                    >
                      <div className="beat-icon">
                        <PlayCircleOutlined />
                      </div>
                      <div className="beat-details">
                        <span className="beat-title" title={beat.title}>
                          {beat.title}
                        </span>
                        <div className="beat-meta">
                          <span>Thời lượng: {beat.duration}</span>
                          <span>•</span>
                          <span style={{ color: 'var(--primary)' }}>Khớp Key</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadPackage}
                  loading={downloading}
                  className="action-btn search-beats-btn"
                  style={{ marginTop: '8px', height: '46px !important' }}
                >
                  Tải Gói Nhạc & Beat (Ráp Vào FL Studio)
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar (Logs & Status) */}
          <div className="lofi-sidebar">
            {progress > 0 && (
              <div className="progress-section">
                <div className="progress-label">
                  <span>Trạng thái tải xuống</span>
                  <span>{progress}%</span>
                </div>
                <Progress percent={progress} showInfo={false} strokeColor="var(--primary)" />
              </div>
            )}

            <Card
              className="logs-card"
              title={
                <div className="card-title">
                  <Radio size={16} /> Tiến trình xử lý
                </div>
              }
            >
              <div className="logs-container">
                {logs.length === 0 ? (
                  <div
                    style={{
                      color: '#94a3b8',
                      fontStyle: 'italic',
                      textAlign: 'center',
                      marginTop: '20px',
                    }}
                  >
                    Chưa có tiến trình...
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className={`log-item ${log.type}`}>
                      <span className="log-time">[{log.time}]</span> {log.text}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LofiHelper;
