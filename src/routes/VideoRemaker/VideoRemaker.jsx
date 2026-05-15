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
} from 'antd';
import {
  DownloadCloud,
  Languages,
  Settings2,
  RotateCw,
  Zap,
  Info,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import './VideoRemakerStyles.scss';

import TTSProvider from '../../_service/TTSProvider';

const { Title, Text } = Typography;

const VideoRemaker = ({ settings }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, downloading, translating, remaking, done
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [options, setOptions] = useState({
    flip: true,
    speed: 1.05,
    crop: true,
    grain: true,
    blurBg: true,
    translate: true,
    targetLang: 'vi',
    ttsServer: 'edge',
    ttsVoice: 'vi-VN-HoaiMyNeural',
    ttsSpeed: 1.0, // Tốc độ giọng đọc riêng biệt
  });
  const [envStatus, setEnvStatus] = useState({ ffmpeg: true, ytdlp: true });

  useEffect(() => {
    const checkEnv = async () => {
      try {
        const res = await window.electron.checkEnv();
        setEnvStatus(res);
        if (!res.ffmpeg || !res.ytdlp) {
          addLog(
            `Cảnh báo: ${!res.ffmpeg ? 'Thiếu FFmpeg. ' : ''}${!res.ytdlp ? 'Thiếu yt-dlp.' : ''}`,
            'error'
          );
        }
      } catch (err) {
        console.error('Check env error:', err);
      }
    };
    checkEnv();
  }, []);

  const addLog = (msg, type = 'info') => {
    setLogs((prev) => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const handleStart = async () => {
    if (!url) return message.warning('Vui lòng nhập link video (Douyin, Youtube, Facebook...)');

    setLoading(true);
    setLogs([]);
    setProgress(0);
    setStatus('downloading');
    addLog(`Bắt đầu xử lý: ${url}`);

    try {
      // Step 1: Download
      addLog('Đang tải video qua yt-dlp...', 'process');
      const downloadRes = await window.electron.videoDownload(url);

      if (!downloadRes.ok) {
        throw new Error(downloadRes.error);
      }

      const inputPath = downloadRes.path;
      setProgress(40);
      addLog(`Đã tải video: ${inputPath}`, 'success');

      // Step 2: Translate (Real AI Voice Extraction & Dubbing)
      let remakeOptions = { ...options };
      if (options.translate) {
        setStatus('translating');

        // 1. Trích xuất audio gốc
        addLog('Đang trích xuất âm thanh gốc từ video...', 'process');
        const extractRes = await window.electron.extractAudio(inputPath);
        if (!extractRes.ok) throw new Error('Không thể trích xuất âm thanh.');

        // 2 & 3. Chuyển âm thanh thành văn bản & Dịch thuật
        let translatedText = '';
        const aiApiKey = settings?.geminiKey || settings?.googleKey || settings?.openaiKey;

        try {
          if (settings?.openaiKey) {
            addLog('Đang nhận diện giọng nói bằng AI Whisper...', 'process');
            const sttRes = await window.electron.transcribeAudio(
              extractRes.path,
              settings.openaiKey
            );

            if (sttRes.ok) {
              const transcribedText = sttRes.text;
              addLog(`Đã nghe được: "${transcribedText.substring(0, 50)}..."`, 'success');

              // Dịch thuật văn bản dùng Gemini/GPT
              addLog(`Đang dịch thuật sang ${options.targetLang}...`, 'process');
              const prompt = `Translate the following text to ${options.targetLang}. Return ONLY the translated text: ${transcribedText}`;
              const translateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${aiApiKey}`;

              const transRes = await window.electron.ttsRequest(translateUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: { contents: [{ parts: [{ text: prompt }] }] },
              });

              if (transRes.ok) {
                translatedText = transRes.data.candidates[0].content.parts[0].text;
              } else {
                translatedText = transcribedText; // Không dịch được thì dùng bản gốc
              }
            } else {
              throw new Error(sttRes.error);
            }
          } else {
            throw new Error('Thiếu OpenAI Key');
          }
        } catch (err) {
          // FALLBACK TO GEMINI AUDIO
          if (
            err.message.includes('quota') ||
            err.message.includes('API Key') ||
            err.message.includes('not found')
          ) {
            addLog('Đang kiểm tra danh sách model Gemini khả dụng...', 'warning');

            const modelsRes = await window.electron.listGeminiModels(aiApiKey);
            if (modelsRes.ok) {
              const availableModels = modelsRes.models.map((m) => m.name.replace('models/', ''));

              // Thử từng model trong danh sách cho đến khi thành công
              let success = false;
              // Sắp xếp lại danh sách ưu tiên
              const priorityModels = availableModels.sort((a, b) => {
                const getScore = (name) => {
                  if (name.includes('2.5-flash')) return 100;
                  if (name.includes('2.0-flash')) return 90;
                  if (name.includes('1.5-flash')) return 80;
                  if (name.includes('2.5-pro')) return 70;
                  if (name.includes('2.0-pro')) return 60;
                  return 0;
                };
                return getScore(b) - getScore(a);
              });

              const base64Res = await window.electron.readFileBase64(extractRes.path);
              if (!base64Res.ok) throw new Error('Không thể đọc file âm thanh.');

              for (const modelName of priorityModels) {
                if (success) break;
                addLog(`Đang thử dịch bằng model: ${modelName}...`, 'process');

                try {
                  const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${aiApiKey}`;
                  const prompt = `Listen to this audio and translate its content to ${options.targetLang}. 
                  IMPORTANT: The translation MUST be concise and brief to fit the video duration. 
                  LƯU Ý: Bản dịch phải CỰC KỲ NGẮN GỌN, súc tích, lược bỏ các từ rườm rà để khớp với thời lượng video gốc. 
                  Return ONLY the translated text.`;

                  const geminiRes = await window.electron.ttsRequest(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                      contents: [
                        {
                          parts: [
                            { text: prompt },
                            { inline_data: { mime_type: 'audio/mp3', data: base64Res.data } },
                          ],
                        },
                      ],
                    },
                  });

                  if (geminiRes.ok && geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    translatedText = geminiRes.data.candidates[0].content.parts[0].text;
                    addLog(`Thành công! Đã dịch xong bằng ${modelName}`, 'success');
                    success = true;
                  } else {
                    const errorMsg = geminiRes.error?.error?.message || 'Bận hoặc không phản hồi.';
                    addLog(`Model ${modelName} không khả dụng: ${errorMsg}`, 'warning');
                  }
                } catch (e) {
                  addLog(`Lỗi khi thử ${modelName}: ${e.message}`, 'warning');
                }
              }

              if (!success)
                throw new Error(
                  'Tất cả các model Gemini đều đang bận hoặc không thể xử lý. Vui lòng thử lại sau.'
                );
            } else {
              throw new Error('Không thể liệt kê danh sách model từ Google.');
            }
          } else {
            throw err;
          }
        }

        addLog(`Kết quả dịch: "${translatedText.substring(0, 50)}..."`, 'success');
        remakeOptions.caption = translatedText;

        // 4. Tạo giọng đọc lồng tiếng mới
        try {
          addLog(`Đang tạo giọng lồng tiếng bằng ${options.ttsServer.toUpperCase()}...`, 'process');
          let audioBlob;

          if (options.ttsServer === 'edge') {
            audioBlob = await TTSProvider.speakWithEdge(
              translatedText,
              options.ttsVoice,
              options.ttsSpeed
            );
          } else if (options.ttsServer === 'google-cloud') {
            audioBlob = await TTSProvider.speakWithGoogleCloud(
              translatedText,
              options.ttsVoice,
              settings.googleKey,
              0,
              options.ttsSpeed
            );
          } else if (options.ttsServer === 'fpt') {
            audioBlob = await TTSProvider.speakWithFPT(
              translatedText,
              options.ttsVoice,
              settings.fptKey,
              options.ttsSpeed - 1
            );
          } else if (options.ttsServer === 'elevenlabs') {
            audioBlob = await TTSProvider.speakWithElevenLabs(
              translatedText,
              options.ttsVoice,
              settings.elevenLabsKey
            );
          } else {
            audioBlob = await TTSProvider.getGoogleAudioBlob(translatedText, options.targetLang);
          }

          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioPath = await window.electron.saveTempAudio(arrayBuffer);
          remakeOptions.externalAudio = audioPath;
          addLog('Đã tạo xong giọng lồng tiếng AI.', 'success');
        } catch (ttsErr) {
          addLog('Lỗi tạo giọng đọc: ' + ttsErr.message, 'error');
        }

        setProgress(70);
      }

      // Step 3: Remake (Lách bản quyền & Lồng tiếng)
      setStatus('remaking');
      addLog('Đang thực hiện remake & lồng tiếng video...', 'process');
      const remakeRes = await window.electron.videoRemake(inputPath, remakeOptions);

      if (!remakeRes.ok) {
        throw new Error(remakeRes.error);
      }

      setProgress(100);
      setStatus('done');
      addLog(`Hoàn tất! Video lưu tại: ${remakeRes.path}`, 'success');
      message.success('Đã remake video thành công!');
    } catch (err) {
      addLog(`Lỗi: ${err.message}`, 'error');
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

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
                onChange={(e) => setUrl(e.target.value)}
                className="custom-input"
                prefix={<ExternalLink size={16} color="#6366f1" />}
                style={{ marginBottom: 32 }}
              />

              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <div className="section-label">
                    <Settings2 size={18} />
                    <span>Lách bản quyền</span>
                  </div>
                  <div className="checkbox-group">
                    <Checkbox
                      checked={options.flip}
                      onChange={(e) => setOptions({ ...options, flip: e.target.checked })}
                    >
                      Lật ngang video
                    </Checkbox>
                    <Checkbox
                      checked={options.crop}
                      onChange={(e) => setOptions({ ...options, crop: e.target.checked })}
                    >
                      Tự động Crop & Zoom
                    </Checkbox>
                    <Checkbox
                      checked={options.grain}
                      onChange={(e) => setOptions({ ...options, grain: e.target.checked })}
                    >
                      Thêm nhiễu hạt
                    </Checkbox>
                    <Checkbox
                      checked={options.blurBg}
                      onChange={(e) => setOptions({ ...options, blurBg: e.target.checked })}
                    >
                      Làm mờ nền
                    </Checkbox>
                  </div>
                </Col>
                <Col span={12}>
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
                            Giọng đọc & Tốc độ Voice
                          </p>
                          <Row gutter={8}>
                            <Col span={14}>
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
                              />
                            </Col>
                            <Col span={10}>
                              <Select
                                size="large"
                                value={options.ttsSpeed}
                                style={{ width: '100%' }}
                                onChange={(val) => setOptions({ ...options, ttsSpeed: val })}
                                options={[
                                  { label: '0.8x', value: 0.8 },
                                  { label: '0.9x', value: 0.9 },
                                  { label: '1.0x', value: 1.0 },
                                  { label: '1.1x', value: 1.1 },
                                  { label: '1.2x', value: 1.2 },
                                ]}
                              />
                            </Col>
                          </Row>
                        </div>
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
                  icon={<RotateCw size={18} className={loading ? 'spin' : ''} />}
                  onClick={handleStart}
                  loading={loading}
                  className="process-btn"
                >
                  {status === 'idle' ? 'Bắt đầu Remake Video' : 'Đang xử lý...'}
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
                  <Progress percent={progress} strokeColor="#6366f1" />
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

              <Card className="tips-card-inner" style={{ marginTop: 24 }}>
                <Title level={5}>
                  <CheckCircle2 size={16} /> Mẹo nhỏ
                </Title>
                <ul className="tips-list">
                  <li>Lật ngang và thay đổi tốc độ giúp lách bản quyền tốt nhất.</li>
                  <li>Sử dụng link Douyin để có chất lượng video cao nhất.</li>
                </ul>
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
    </div>
  );
};

export default VideoRemaker;
