import { useState, useEffect } from 'react';
import { Card, Input, Button, Slider, Typography, Divider, message, Tag, Select } from 'antd';
import {
  PlayCircleOutlined,
  HistoryOutlined,
  DashboardOutlined,
  PauseCircleOutlined,
  StopOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { Volume2, Sparkles, Mic2 } from 'lucide-react';
import HistoryModal from '../../components/History/HistoryModal';
import TTSProvider from '../../_service/TTSProvider';
import './TextToSpeedStyles.scss';

const { Title, Text } = Typography;
const { TextArea } = Input;

const AI_VOICES = [
  // FPT AI - Các giọng đặc trưng
  { id: 'giahuy', name: 'Gia Huy (Bé trai)', provider: 'FPT', lang: 'vi-VN', type: 'child' },
  { id: 'banmai', name: 'Ban Mai (Nữ Bắc)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },
  { id: 'thuminh', name: 'Thu Minh (Nữ Bắc)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },
  { id: 'leminh', name: 'Lê Minh (Nam Bắc)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },
  { id: 'mybinh', name: 'Mỹ Bình (Nữ Trung)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },
  { id: 'linh', name: 'Linh (Nữ Nam)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },
  { id: 'minhquang', name: 'Minh Quang (Nam Nam)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },

  // Google Cloud - Các giọng Neural2 & Wavenet
  {
    id: 'vi-VN-Wavenet-D',
    name: 'Neural (Bé trai VN)',
    provider: 'Google',
    lang: 'vi-VN',
    type: 'child',
  },
  {
    id: 'vi-VN-Wavenet-A',
    name: 'Neural (Nữ VN)',
    provider: 'Google',
    lang: 'vi-VN',
    type: 'adult',
  },
  {
    id: 'vi-VN-Wavenet-B',
    name: 'Neural (Nam VN)',
    provider: 'Google',
    lang: 'vi-VN',
    type: 'adult',
  },
  {
    id: 'en-US-Wavenet-D',
    name: 'Neural (US Boy)',
    provider: 'Google',
    lang: 'en-US',
    type: 'child',
  },
  {
    id: 'en-GB-Wavenet-D',
    name: 'Neural (UK Boy)',
    provider: 'Google',
    lang: 'en-GB',
    type: 'child',
  },
  {
    id: 'en-AU-Wavenet-D',
    name: 'Neural (AU Boy)',
    provider: 'Google',
    lang: 'en-AU',
    type: 'child',
  },

  // Microsoft Edge TTS - MIỄN PHÍ & CHẤT LƯỢNG CAO (Tiếng Anh)
  { id: 'en-US-AndrewNeural', name: 'Andrew (Nam - Edge)', provider: 'Edge', lang: 'en-US', type: 'adult' },
  { id: 'en-US-AvaNeural', name: 'Ava (Nữ - Edge)', provider: 'Edge', lang: 'en-US', type: 'adult' },
  { id: 'en-US-BrianNeural', name: 'Brian (Nam - Edge)', provider: 'Edge', lang: 'en-US', type: 'adult' },
  { id: 'en-US-EmmaNeural', name: 'Emma (Nữ - Edge)', provider: 'Edge', lang: 'en-US', type: 'adult' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (Nữ UK - Edge)', provider: 'Edge', lang: 'en-GB', type: 'adult' },
  { id: 'vi-VN-HoaiMyNeural', name: 'Hoài My (Nữ VN - Edge)', provider: 'Edge', lang: 'vi-VN', type: 'adult' },
  { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh (Nam VN - Edge)', provider: 'Edge', lang: 'vi-VN', type: 'adult' },

  // OpenAI TTS - Cao cấp
  { id: 'alloy', name: 'Alloy (Đa năng - OpenAI)', provider: 'OpenAI', lang: 'en-US', type: 'adult' },
  { id: 'nova', name: 'Nova (Nữ - OpenAI)', provider: 'OpenAI', lang: 'en-US', type: 'adult' },
  { id: 'onyx', name: 'Onyx (Nam trầm - OpenAI)', provider: 'OpenAI', lang: 'en-US', type: 'adult' },
];

const TextToSpeed = ({ settings }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState(AI_VOICES[0].id);
  const [systemVoices, setSystemVoices] = useState([]);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [delay, setDelay] = useState(0);
  const [history, setHistory] = useState(() =>
    JSON.parse(localStorage.getItem('tts_history') || '[]')
  );
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState('idle'); // 'idle', 'playing', 'paused'
  const [currentAudio, setCurrentAudio] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(null);
  const [isSystemVoiceMode, setIsSystemVoiceMode] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setSystemVoices(voices.filter((v) => v.lang.includes('vi') || v.lang.includes('en')));
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    localStorage.setItem('tts_history', JSON.stringify(history));
  }, [history]);

  const handleSpeak = async () => {
    if (!text.trim()) return message.warning('Vui lòng nhập văn bản!');

    // Nếu đang phát thì tạm dừng
    if (playbackStatus === 'playing') {
      if (isSystemVoiceMode) {
        window.speechSynthesis.pause();
      } else if (currentAudio) {
        currentAudio.pause();
      }
      setPlaybackStatus('paused');
      return;
    }

    // Nếu đang tạm dừng thì tiếp tục
    if (playbackStatus === 'paused') {
      if (isSystemVoiceMode) {
        window.speechSynthesis.resume();
      } else if (currentAudio) {
        currentAudio.play();
      }
      setPlaybackStatus('playing');
      return;
    }

    // Nếu đang idle thì bắt đầu mới
    let selectedVoice = AI_VOICES.find((v) => v.id === selectedVoiceId);
    let isSystemVoice = false;

    if (!selectedVoice) {
      selectedVoice = systemVoices.find((v) => v.voiceURI === selectedVoiceId);
      isSystemVoice = true;
    }

    if (!selectedVoice) return;

    setLoading(true);
    let finalUrl = null;
    try {
      // Áp dụng độ trễ nếu có
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      }

      if (isSystemVoice) {
        setIsSystemVoiceMode(true);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = selectedVoice;
        utterance.rate = rate;
        utterance.pitch = (pitch + 20) / 20; // Chuyển từ dải -20..20 sang 0..2 của hệ thống
        utterance.onend = () => {
          setPlaybackStatus('idle');
        };
        window.speechSynthesis.cancel(); // Dừng cái cũ nếu có
        window.speechSynthesis.speak(utterance);
        setPlaybackStatus('playing');
      } else {
        setIsSystemVoiceMode(false);
        let audioUrl;
        if (selectedVoice.provider === 'FPT') {
          audioUrl = await TTSProvider.speakWithFPT(
            text,
            selectedVoice.id,
            settings.fptKey,
            rate,
            pitch
          );
        } else if (selectedVoice.provider === 'Google') {
          audioUrl = await TTSProvider.speakWithGoogleCloud(
            text,
            selectedVoice.id,
            settings.googleKey,
            pitch,
            rate
          );
        } else if (selectedVoice.provider === 'Edge') {
          audioUrl = await TTSProvider.speakWithEdge(
            text,
            selectedVoice.id,
            rate
          );
        } else {
          audioUrl = await TTSProvider.speakWithOpenAI(
            text, 
            selectedVoice.id === 'alloy' || selectedVoice.id === 'nova' || selectedVoice.id === 'onyx' ? selectedVoice.id : 'alloy', 
            settings.openaiKey, 
            rate
          );
        }

        if (!audioUrl) throw new Error('Không nhận được dữ liệu âm thanh.');
        finalUrl = typeof audioUrl === 'string' ? audioUrl : URL.createObjectURL(audioUrl);
        const audio = new Audio(finalUrl);

        audio.onended = () => {
          setPlaybackStatus('idle');
        };

        setCurrentAudio(audio);
        setCurrentUrl(finalUrl);
        await audio.play();
        setPlaybackStatus('playing');
      }

      const newHistoryItem = {
        id: Date.now(),
        text: text,
        voiceId: selectedVoiceId,
        voiceName: selectedVoice.name,
        provider: isSystemVoice ? 'System' : selectedVoice.provider,
        timestamp: new Date().toISOString(),
        rate,
        pitch,
        audioUrl: isSystemVoice ? null : finalUrl,
      };

      setHistory([newHistoryItem, ...history]);
    } catch (err) {
      console.error('TTS Error:', err);
      message.error('Lỗi: ' + err.message);
      setPlaybackStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = () => {
    if (isSystemVoiceMode) {
      window.speechSynthesis.cancel();
    } else if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    setPlaybackStatus('idle');
  };

  const handleDownload = () => {
    if (!currentUrl) return message.warning('Chưa có âm thanh để tải!');

    try {
      if (window.electron && window.electron.downloadFile) {
        window.electron.downloadFile(currentUrl, `tts-voice-${Date.now()}.mp3`);
        message.success('Đã bắt đầu tải xuống...');
      } else {
        // Fallback cho trình duyệt
        const link = document.createElement('a');
        link.href = currentUrl;
        link.download = `tts-voice-${Date.now()}.mp3`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Download Error:', err);
      window.open(currentUrl, '_blank');
    }
  };

  return (
    <div className="tts-container">
      <Card variant="borderless" className="tts-card">
        <div className="tts-layout">
          <div className="tts-main-content">
            <header className="main-header">
              <Title level={1} className="tts-gradient-title">
                AI Voice Master
              </Title>
              <div className="main-status">
                <Sparkles size={18} style={{ color: '#f59e0b' }} />
                <span>Trình tạo giọng nói AI cao cấp</span>
                <Divider type="vertical" />
                <Tag color="blue" bordered={false} style={{ borderRadius: '6px', fontWeight: 600 }}>
                  v1.2.0
                </Tag>
              </div>
            </header>

            <div className="input-section">
              <div className="input-header">
                <span className="slider-icon-text">
                  <Volume2 size={16} /> Nhập nội dung văn bản
                </span>
                <span className="char-count">{text.length} / 5000</span>
              </div>
              <TextArea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ví dụ: Xin chào, tôi là trợ lý ảo của bạn..."
                className="tts-textarea"
              />
            </div>

            <div className="tts-voice-box">
              <div className="voice-label">
                <Mic2 size={18} /> Chọn giọng nói thông minh
              </div>
              <Select
                showSearch
                className="custom-select"
                placeholder="Chọn một giọng nói..."
                value={selectedVoiceId}
                onChange={setSelectedVoiceId}
                optionFilterProp="label"
                options={[
                  {
                    label: 'FPT.AI - Giọng Việt Nam',
                    options: AI_VOICES.filter((v) => v.provider === 'FPT').map((v) => ({
                      value: v.id,
                      label: v.name,
                    })),
                  },
                  {
                    label: 'Google Cloud - Cao cấp',
                    options: AI_VOICES.filter((v) => v.provider === 'Google').map((v) => ({
                      value: v.id,
                      label: v.name,
                    })),
                  },
                  {
                    label: 'Microsoft Edge - Miễn phí (Khuyên dùng)',
                    options: AI_VOICES.filter((v) => v.provider === 'Edge').map((v) => ({
                      value: v.id,
                      label: v.name,
                    })),
                  },
                  {
                    label: 'Giọng hệ thống (Offline)',
                    options: systemVoices.map((v) => ({
                      value: v.voiceURI,
                      label: `${v.name} (${v.lang})`,
                    })),
                  },
                ]}
              />
            </div>

            <div className="tts-sliders-grid">
              <div className="slider-item">
                <div className="slider-label">
                  <span className="slider-icon-text">
                    <DashboardOutlined /> Tốc độ
                  </span>
                  <span className="slider-value">x{rate}</span>
                </div>
                <Slider
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={rate}
                  onChange={setRate}
                  tooltip={{ open: false }}
                />
              </div>

              <div className="slider-item">
                <div className="slider-label">
                  <span className="slider-icon-text">
                    <Volume2 size={16} /> Cao độ
                  </span>
                  <span className="slider-value">{pitch}</span>
                </div>
                <Slider
                  min={-20}
                  max={20}
                  step={1}
                  value={pitch}
                  onChange={setPitch}
                  tooltip={{ open: false }}
                />
              </div>

              <div className="slider-item">
                <div className="slider-label">
                  <span className="slider-icon-text">
                    <HistoryOutlined /> Độ trễ
                  </span>
                  <span className="slider-value">{delay}s</span>
                </div>
                <Slider
                  min={0}
                  max={5}
                  step={0.5}
                  value={delay}
                  onChange={setDelay}
                  tooltip={{ open: false }}
                />
              </div>
            </div>

            <div className="controls-row">
              <Button
                type="primary"
                icon={
                  playbackStatus === 'playing' ? (
                    <PauseCircleOutlined style={{ fontSize: '22px' }} />
                  ) : (
                    <PlayCircleOutlined style={{ fontSize: '22px' }} />
                  )
                }
                loading={loading}
                onClick={handleSpeak}
                className={`tts-btn-play ${playbackStatus !== 'idle' ? 'active' : ''}`}
              >
                {loading
                  ? 'ĐANG XỬ LÝ...'
                  : playbackStatus === 'playing'
                    ? 'TẠM DỪNG'
                    : playbackStatus === 'paused'
                      ? 'TIẾP TỤC PHÁT'
                      : 'CHUYỂN ĐỔI & PHÁT'}
              </Button>

              {playbackStatus !== 'idle' && (
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={handleStop}
                  className="tts-btn-stop"
                >
                  KẾT THÚC
                </Button>
              )}

              {currentUrl && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  className="tts-btn-download"
                >
                  TẢI VOICE
                </Button>
              )}

              <Button
                icon={<HistoryOutlined />}
                onClick={() => setShowHistoryModal(true)}
                className="tts-btn-action"
                title="Lịch sử"
              />
            </div>
          </div>
        </div>
      </Card>

      <HistoryModal
        open={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        history={history}
        onClear={() => setHistory([])}
        onSelect={(item) => {
          setText(item.text || item.fullText || '');
          setSelectedVoiceId(item.voiceId || AI_VOICES[0].id);
          setShowHistoryModal(false);
        }}
      />
    </div>
  );
};

export default TextToSpeed;
