import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Input,
  Select,
  Button,
  Typography,
  Divider,
  Row,
  Col,
  Slider,
  Tooltip,
  Badge,
  Tag,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  SettingOutlined,
  HistoryOutlined,
  AudioOutlined,
  SoundOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { Volume2, VolumeX, FastForward, Sparkles } from 'lucide-react';
import { useWindowSize } from 'react-use';
import SettingsModal from '../../components/SettingsModal';
import HistoryList from '../../components/HistoryList';
import HistoryModal from '../../components/HistoryModal';
import TTSProvider from '../../_service/TTSProvider';
import './HomeStyles.scss';

const { Title, Text } = Typography;
const { TextArea } = Input;

const OPENAI_VOICES = [
  { value: 'alloy', label: 'Alloy (Trung tính)' },
  { value: 'echo', label: 'Echo (Mạnh mẽ)' },
  { value: 'fable', label: 'Fable (Kể chuyện)' },
  { value: 'onyx', label: 'Onyx (Trầm ấm)' },
  { value: 'nova', label: 'Nova (Sáng sủa)' },
  { value: 'shimmer', label: 'Shimmer (Dịu dàng)' },
];

const FPT_VOICES = [
  { value: 'banmai', label: 'Ban Mai (Nữ - Miền Bắc)' },
  { value: 'thu-minh', label: 'Thu Minh (Nữ - Miền Bắc)' },
  { value: 'minhquang', label: 'Minh Quang (Nam - Miền Bắc)' },
  { value: 'myan', label: 'Mỹ An (Nữ - Miền Trung)' },
  { value: 'giahuy', label: 'Gia Huy (Nam - Miền Trung)' },
  { value: 'lananh', label: 'Lan Anh (Nữ - Miền Nam)' },
  { value: 'leminh', label: 'Lê Minh (Nam - Miền Nam)' },
];

const EDGE_VOICES = [
  { value: 'vi-VN-HoaiMyNeural', label: 'Hoài My (Nữ - Tự nhiên)' },
  { value: 'vi-VN-NamMinhNeural', label: 'Nam Minh (Nam - Tự nhiên)' },
  { value: 'en-US-AriaNeural', label: 'Aria (Nữ - Tiếng Anh)' },
  { value: 'en-US-GuyNeural', label: 'Guy (Nam - Tiếng Anh)' },
];

const GOOGLE_VOICES = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'Tiếng Anh (US)' },
  { value: 'ja', label: 'Tiếng Nhật' },
  { value: 'ko', label: 'Tiếng Hàn' },
];

const TextToSpeech = () => {
  const { width } = useWindowSize();
  const [text, setText] = useState('');
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [history, setHistory] = useState(() =>
    JSON.parse(localStorage.getItem('tts_history') || '[]')
  );
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() =>
    JSON.parse(
      localStorage.getItem('tts_settings') ||
        '{"useExternal": false, "provider": "openai", "openaiKey": "", "fptKey": ""}'
    )
  );
  const [loading, setLoading] = useState(false);
  const [externalAudio, setExternalAudio] = useState(null);

  const synth = window.speechSynthesis;
  const audioRef = useRef(new Audio());
  const googleAudioQueue = useRef([]);

  // Ngưỡng chuyển đổi giữa Sidebar và Modal (1100px)
  const isMobile = width < 1100;

  const loadVoices = useCallback(() => {
    if (settings.useExternal) {
      let currentVoices = [];
      switch (settings.provider) {
        case 'openai':
          currentVoices = OPENAI_VOICES;
          break;
        case 'fpt':
          currentVoices = FPT_VOICES;
          break;
        case 'edge':
          currentVoices = EDGE_VOICES;
          break;
        case 'google':
          currentVoices = GOOGLE_VOICES;
          break;
        default:
          currentVoices = OPENAI_VOICES;
      }
      setVoices(currentVoices);
      if (!currentVoices.find((v) => v.value === selectedVoice)) {
        setSelectedVoice(currentVoices[0].value);
      }
    } else {
      const availableVoices = synth.getVoices();
      setVoices(
        availableVoices.map((v) => ({
          value: v.name,
          label: `${v.name} (${v.lang})`,
          lang: v.lang,
        }))
      );

      if (
        availableVoices.length > 0 &&
        (!selectedVoice || !availableVoices.find((v) => v.name === selectedVoice))
      ) {
        const viVoice = availableVoices.find((v) => v.lang.includes('vi'));
        setSelectedVoice(viVoice ? viVoice.name : availableVoices[0]?.name);
      }
    }
  }, [synth, selectedVoice, settings.useExternal, settings.provider]);

  useEffect(() => {
    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
    return () => {
      synth.cancel();
      audioRef.current.pause();
    };
  }, [loadVoices, synth]);

  useEffect(() => {
    localStorage.setItem('tts_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('tts_settings', JSON.stringify(settings));
  }, [settings]);

  const handleSpeak = async () => {
    if (!text.trim()) return;

    if (isPaused) {
      if (settings.useExternal) {
        audioRef.current.play();
      } else {
        synth.resume();
      }
      setIsPaused(false);
      setIsSpeaking(true);
      return;
    }

    handleStop();

    if (settings.useExternal) {
      try {
        setLoading(true);
        setIsSpeaking(true);

        if (settings.provider === 'openai') {
          const audioBlob = await TTSProvider.speakWithOpenAI(
            text,
            selectedVoice,
            settings.openaiKey,
            rate
          );
          const url = URL.createObjectURL(audioBlob);
          playExternalAudio(url);
        } else if (settings.provider === 'fpt') {
          const fptSpeed = Math.round((rate - 1) * 3);
          const url = await TTSProvider.speakWithFPT(
            text,
            selectedVoice,
            settings.fptKey,
            fptSpeed
          );
          playExternalAudio(url);
        } else if (settings.provider === 'google') {
          const urls = TTSProvider.getGoogleTranslateUrls(text, selectedVoice);
          playSequentialAudio(urls);
        } else if (settings.provider === 'edge') {
          const url = TTSProvider.getEdgeTTSUrl(text, selectedVoice);
          playExternalAudio(url);
        }
      } catch (error) {
        let errorMsg = error.message;
        if (errorMsg.includes('429') || errorMsg.includes('quota')) {
          errorMsg = (
            <span>
              Tài khoản {settings.provider.toUpperCase()} của bạn đã hết số dư hoặc vượt hạn mức.
              Bạn có thể chuyển sang <b>Giọng nói Hệ thống</b> trong phần Cài đặt để tiếp tục sử
              dụng miễn phí.
            </span>
          );
        }
        message.error({ content: errorMsg, duration: 10 });
        setIsSpeaking(false);
      } finally {
        setLoading(false);
      }
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = synth.getVoices().find((v) => v.name === selectedVoice);
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        addToHistory();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      synth.speak(utterance);
    }
  };

  const playExternalAudio = (url) => {
    console.log('Playing External Audio:', url);
    setExternalAudio(url);
    audioRef.current.src = url;
    audioRef.current.volume = volume; // Đảm bảo áp dụng âm lượng

    audioRef.current.play().catch((err) => {
      console.error('Playback failed:', err);
      message.error('Trình duyệt chặn tự động phát hoặc lỗi âm thanh. Vui lòng thử lại.');
      setIsSpeaking(false);
    });

    audioRef.current.onended = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      addToHistory();
    };

    audioRef.current.onerror = (e) => {
      console.error('Audio error:', e);
      message.error('Lỗi khi tải âm thanh từ nhà cung cấp.');
      setIsSpeaking(false);
      setLoading(false);
    };
  };

  const playSequentialAudio = (urls) => {
    console.log('Playing Sequential Audio (Google):', urls);
    googleAudioQueue.current = [...urls];

    const playNext = () => {
      if (googleAudioQueue.current.length === 0) {
        setIsSpeaking(false);
        setIsPaused(false);
        addToHistory();
        return;
      }
      const nextUrl = googleAudioQueue.current.shift();
      audioRef.current.src = nextUrl;
      audioRef.current.volume = volume;

      audioRef.current.play().catch((err) => {
        console.error('Sequential Playback failed:', err);
        setIsSpeaking(false);
      });

      audioRef.current.onended = playNext;
      audioRef.current.onerror = (e) => {
        console.error('Sequential Audio error:', e);
        playNext(); // Thử đoạn tiếp theo nếu đoạn này lỗi
      };
    };
    playNext();
  };

  const addToHistory = () => {
    if (!history.find((h) => h.text === text)) {
      setHistory((prev) =>
        [
          {
            text,
            date: new Date().toLocaleString(),
            voice: selectedVoice,
            external: settings.useExternal,
          },
          ...prev,
        ].slice(0, 10)
      );
    }
  };

  const handlePause = () => {
    if (isSpeaking) {
      if (settings.useExternal) {
        audioRef.current.pause();
      } else {
        synth.pause();
      }
      setIsPaused(true);
      setIsSpeaking(false);
    }
  };

  const handleStop = () => {
    synth.cancel();
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const handleDownload = () => {
    if (externalAudio) {
      const a = document.createElement('a');
      a.href = externalAudio;
      a.download = `tts-voice-${new Date().getTime()}.mp3`;
      a.click();
    } else {
      message.info('Chỉ có thể tải xuống khi sử dụng giọng nói AI bên ngoài.');
    }
  };

  return (
    <div className="tts-container">
      <Card className={`tts-card ${showHistory && !isMobile ? 'has-sidebar' : ''}`}>
        <div className="tts-layout">
          <div className="tts-main-content">
            <div className="main-header">
              <div className="main-title-section">
                <Title level={2} className="tts-gradient-title">
                  Chuyển văn bản thành giọng nói
                </Title>
                <div className="main-status">
                  {settings.useExternal ? (
                    <Sparkles size={14} className="text-amber-500" />
                  ) : (
                    <AudioOutlined />
                  )}
                  <Text type="secondary">
                    {settings.useExternal
                      ? 'Đang dùng giọng nói AI Cao cấp'
                      : 'Đang dùng giọng nói Hệ thống'}
                  </Text>
                </div>
              </div>
              <div className="main-actions">
                <Badge count={history.length} size="small">
                  <Button
                    icon={<HistoryOutlined />}
                    onClick={() => setShowHistory(!showHistory)}
                    type={showHistory ? 'primary' : 'default'}
                    shape="circle"
                  />
                </Badge>
                <Button
                  icon={<SettingOutlined />}
                  shape="circle"
                  onClick={() => setShowSettings(true)}
                />
              </div>
            </div>

            <div className="input-section">
              <div className="input-header">
                <Text strong className="text-gray-700">
                  Văn bản cần đọc
                </Text>
                <Text type="secondary" className="text-xs">
                  {text.length} ký tự
                </Text>
              </div>
              <TextArea
                rows={8}
                placeholder="Nhập văn bản bạn muốn chuyển đổi sang giọng nói tại đây..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="tts-textarea"
              />
            </div>

            <Row gutter={[24, 24]} className="mb-8">
              <Col xs={24} md={12}>
                <div className="tts-voice-box">
                  <Text strong className="block mb-3 text-blue-800">
                    Chọn giọng nói
                  </Text>
                  <Select
                    className="w-full custom-select"
                    showSearch
                    placeholder="Chọn giọng nói..."
                    value={selectedVoice}
                    onChange={setSelectedVoice}
                    options={voices}
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div className="controls-row">
                  {!isSpeaking || isPaused ? (
                    <Button
                      type="primary"
                      size="large"
                      icon={<PlayCircleOutlined />}
                      className="tts-btn-play"
                      onClick={handleSpeak}
                      disabled={!text.trim()}
                      loading={loading}
                    >
                      {isPaused ? 'Tiếp tục' : 'Phát giọng nói'}
                    </Button>
                  ) : (
                    <Button
                      type="default"
                      size="large"
                      icon={<PauseCircleOutlined />}
                      className="tts-btn-play pause-btn"
                      onClick={handlePause}
                    />
                  )}
                  <Button
                    danger
                    size="large"
                    icon={<StopOutlined />}
                    className="tts-btn-action"
                    onClick={handleStop}
                    disabled={!isSpeaking && !isPaused}
                  />
                  {settings.useExternal && (
                    <Tooltip title="Tải xuống MP3">
                      <Button
                        size="large"
                        icon={<DownloadOutlined />}
                        className="tts-btn-action download-btn"
                        onClick={handleDownload}
                        disabled={!externalAudio}
                      />
                    </Tooltip>
                  )}
                </div>
              </Col>
            </Row>

            <Divider className="my-6" />

            <div className="tts-sliders-grid">
              <div className="slider-item">
                <div className="slider-label">
                  <Text type="secondary" className="slider-icon-text">
                    <FastForward size={16} /> Tốc độ
                  </Text>
                  <Tag color="blue">{rate}x</Tag>
                </div>
                <Slider
                  min={settings.useExternal ? 0.25 : 0.5}
                  max={settings.useExternal ? 4 : 2}
                  step={0.1}
                  value={rate}
                  onChange={setRate}
                  tooltip={{ open: false }}
                />
              </div>

              <div className="slider-item">
                <div className="slider-label">
                  <Text type="secondary" className="slider-icon-text">
                    <SoundOutlined /> Cao độ
                  </Text>
                  <Tag color="indigo">{pitch}</Tag>
                </div>
                <Slider
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={pitch}
                  onChange={setPitch}
                  disabled={settings.useExternal}
                  tooltip={{ open: false }}
                />
              </div>

              <div className="slider-item">
                <div className="slider-label">
                  <Text type="secondary" className="slider-icon-text">
                    {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />} Âm lượng
                  </Text>
                  <Tag color="cyan">{Math.round(volume * 100)}%</Tag>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onChange={setVolume}
                  tooltip={{ open: false }}
                />
              </div>
            </div>
          </div>

          {showHistory && !isMobile && (
            <div className="tts-sidebar tts-animate-slide">
              <HistoryList
                history={history}
                onClearHistory={() => setHistory([])}
                onSelectItem={(item) => setText(item.text)}
              />
            </div>
          )}
        </div>
      </Card>

      <HistoryModal
        open={showHistory && isMobile}
        onCancel={() => setShowHistory(false)}
        history={history}
        onClearHistory={() => setHistory([])}
        onSelectItem={(item) => setText(item.text)}
      />

      <SettingsModal
        open={showSettings}
        onCancel={() => setShowSettings(false)}
        settings={settings}
        onSave={(vals) => setSettings(vals)}
      />
    </div>
  );
};

export default TextToSpeech;
