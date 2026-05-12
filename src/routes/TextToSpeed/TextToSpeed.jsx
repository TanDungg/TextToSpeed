import { useState, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Slider,
  Typography,
  Row,
  Col,
  Space,
  Divider,
  message,
  Tag,
} from 'antd';
import { PlayCircleOutlined, HistoryOutlined, DashboardOutlined } from '@ant-design/icons';
import { Volume2, Sparkles, Mic2 } from 'lucide-react';
import HistoryModal from '../../components/History/HistoryModal';
import TTSProvider from '../../_service/TTSProvider';
import './TextToSpeedStyles.scss';

const { Title, Text } = Typography;
const { TextArea } = Input;

const AI_VOICES = [
  // FPT AI - Các giọng đặc trưng
  { id: 'gia_huy', name: 'Gia Huy (Bé trai)', provider: 'FPT', lang: 'vi-VN', type: 'child' },
  { id: 'banmai', name: 'Ban Mai (Nữ Bắc)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },
  { id: 'thuminh', name: 'Thu Minh (Nữ Bắc)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },
  { id: 'leminh', name: 'Lê Minh (Nam Bắc)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },
  { id: 'mybinh', name: 'Mỹ Bình (Nữ Trung)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },
  { id: 'linh', name: 'Linh (Nữ Nam)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },
  { id: 'minhquang', name: 'Minh Quang (Nam Nam)', provider: 'FPT', lang: 'vi-VN', type: 'adult' },

  // Google Cloud - Các giọng Neural2 & Wavenet
  {
    id: 'vi-VN-Wavenet-D',
    name: 'Cậu bé VN (Google)',
    provider: 'Google',
    lang: 'vi-VN',
    type: 'child',
  },
  {
    id: 'vi-VN-Wavenet-A',
    name: 'Nữ VN (Google)',
    provider: 'Google',
    lang: 'vi-VN',
    type: 'adult',
  },
  {
    id: 'vi-VN-Wavenet-B',
    name: 'Nam VN (Google)',
    provider: 'Google',
    lang: 'vi-VN',
    type: 'adult',
  },
  {
    id: 'en-US-Wavenet-D',
    name: 'US Boy (English)',
    provider: 'Google',
    lang: 'en-US',
    type: 'child',
  },
  {
    id: 'en-GB-Wavenet-D',
    name: 'UK Boy (English)',
    provider: 'Google',
    lang: 'en-GB',
    type: 'child',
  },
  {
    id: 'en-AU-Wavenet-D',
    name: 'AU Boy (English)',
    provider: 'Google',
    lang: 'en-AU',
    type: 'child',
  },
];

const TextToSpeed = ({ settings }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(AI_VOICES[0]);
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [history, setHistory] = useState(() =>
    JSON.parse(localStorage.getItem('tts_history') || '[]')
  );
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    localStorage.setItem('tts_history', JSON.stringify(history));
  }, [history]);

  const handleSpeak = async () => {
    if (!text.trim()) return message.warning('Vui lòng nhập văn bản!');
    setLoading(true);
    try {
      let audioUrl;
      if (selectedVoice.provider === 'FPT') {
        audioUrl = await TTSProvider.speakWithFPT(
          text,
          selectedVoice.id,
          settings.fptKey,
          speed,
          pitch
        );
      } else if (selectedVoice.provider === 'Google') {
        audioUrl = await TTSProvider.speakWithGoogleCloud(
          text,
          selectedVoice.id,
          settings.googleKey,
          speed,
          pitch
        );
      }

      if (!audioUrl) {
        throw new Error('Không nhận được dữ liệu âm thanh từ máy chủ.');
      }

      const audio = new Audio(audioUrl);
      await audio.play();

      setHistory([
        {
          id: Date.now(),
          text: text.substring(0, 100),
          voice: selectedVoice.name,
          date: new Date().toLocaleString(),
          fullText: text,
          speed,
          pitch,
        },
        ...history,
      ]);
    } catch (err) {
      console.error('TTS Error:', err);
      message.error('Lỗi phát âm thanh: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tts-container">
      <Card bordered={false} className="tts-card">
        {/* Header */}
        <div className="main-header" style={{ marginBottom: 32 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div className="header-icon-box">
                  <Volume2 size={30} />
                </div>
                <div>
                  <Title level={2} className="tts-gradient-title" style={{ margin: 0 }}>
                    AI Voice Master
                  </Title>
                  <Space size={4}>
                    <Sparkles size={14} className="text-amber-500" />
                    <Text type="secondary">Chuyển văn bản thành giọng nói tự nhiên</Text>
                  </Space>
                </div>
              </div>
            </Col>
            <Col>
              <Button
                icon={<HistoryOutlined />}
                onClick={() => setShowHistory(true)}
                className="btn-history"
              >
                Lịch sử
              </Button>
            </Col>
          </Row>
        </div>

        {/* Input Area */}
        <div className="text-input-area" style={{ marginBottom: 24 }}>
          <TextArea
            placeholder="Nhập nội dung bạn muốn chuyển thành giọng nói tại đây..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            variant="borderless"
            style={{ resize: 'none' }}
          />
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <Text type="secondary">{text.length} ký tự</Text>
          </div>
        </div>

        {/* Configurations */}
        <Row gutter={[24, 24]}>
          <Col xs={24} md={10}>
            <div className="config-section-box">
              <div className="section-title">
                <DashboardOutlined />
                <span>Điều chỉnh âm thanh</span>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div className="slider-label-row">
                  <Text strong>Tốc độ đọc</Text>
                  <Tag color="blue">{speed}x</Tag>
                </div>
                <Slider
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={speed}
                  onChange={setSpeed}
                  className="custom-tts-slider"
                />
              </div>
              <div>
                <div className="slider-label-row">
                  <Text strong>Cao độ (Pitch)</Text>
                  <Tag color="cyan">{pitch}x</Tag>
                </div>
                <Slider
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={pitch}
                  onChange={setPitch}
                  className="custom-tts-slider"
                />
              </div>
            </div>
          </Col>

          <Col xs={24} md={14}>
            <div className="config-section-box">
              <div className="section-title">
                <Mic2 size={18} />
                <span>Chọn giọng đọc</span>
              </div>
              <div className="voice-selection-grid">
                {AI_VOICES.map((voice) => (
                  <div
                    key={voice.id}
                    className={`voice-card ${selectedVoice.id === voice.id ? 'selected' : ''}`}
                    onClick={() => setSelectedVoice(voice)}
                  >
                    <span className="voice-name">{voice.name}</span>
                    <span className="voice-provider">{voice.provider}</span>
                  </div>
                ))}
              </div>
            </div>
          </Col>
        </Row>

        <Divider style={{ margin: '32px 0' }} />

        {/* Action Button */}
        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined style={{ fontSize: '24px' }} />}
            loading={loading}
            onClick={handleSpeak}
            className="btn-speak-main"
          >
            CHUYỂN THÀNH GIỌNG NÓI
          </Button>
        </div>
      </Card>

      <HistoryModal
        open={showHistory}
        onCancel={() => setShowHistory(false)}
        history={history}
        onClearHistory={() => setHistory([])}
        onSelectItem={(item) => {
          setText(item.fullText);
          setSpeed(item.speed);
          setPitch(item.pitch);
        }}
      />
    </div>
  );
};

export default TextToSpeed;
