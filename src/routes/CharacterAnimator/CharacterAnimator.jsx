import { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Card,
  Upload,
  Progress,
  Space,
  Alert,
  Row,
  Col,
  App,
  Radio,
  Tooltip,
} from 'antd';
import {
  FolderOpenOutlined,
  UploadOutlined,
  PlayCircleOutlined,
  PictureOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { BASE_URL_API } from '../../constants/config';
import './CharacterAnimatorStyles.scss';

const { Dragger } = Upload;

const PRESET_VIDEOS = [
  {
    key: 'd0',
    label: 'Mẫu hát / Biểu cảm 1',
    description: 'Hát nhép khớp khẩu hình & biểu cảm mặt tự nhiên.',
    url: 'https://raw.githubusercontent.com/KwaiVGI/LivePortrait/main/assets/examples/driving/d0.mp4',
    type: 'face',
  },
  {
    key: 'd1',
    label: 'Mẫu hát / Biểu cảm 2',
    description: 'Bắt chuyển động nháy mắt, nghiêng đầu.',
    url: 'https://raw.githubusercontent.com/KwaiVGI/LivePortrait/main/assets/examples/driving/d1.mp4',
    type: 'face',
  },
  {
    key: 'dance',
    label: 'Mẫu nhảy Tiktok',
    description: 'Chuyển động nhảy toàn thân cơ bản.',
    url: 'https://raw.githubusercontent.com/Tencent/MimicMotion/main/assets/example_data/dance.mp4',
    type: 'body',
  },
];

const CharacterAnimator = ({ globalSettings }) => {
  const { message } = App.useApp();
  const isElectron = window.electron && !window.electron.isWebMock;
  const [characterImage, setCharacterImage] = useState(null); // { file, base64, previewUrl, path }
  const [drivingVideo, setDrivingVideo] = useState(null); // { file, path, previewUrl, isPreset, presetUrl }
  const [mode, setMode] = useState('pipeline'); // pipeline, body, face
  const [outputDir, setOutputDir] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [processLogs, setProcessLogs] = useState([]); // Array of { text, status: 'pending'|'loading'|'done'|'error' }
  const [resultVideoPath, setResultVideoPath] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Engine state (fal or replicate)
  const [engine, setEngine] = useState('fal');
  // Local API Key states
  const [localReplicateKey, setLocalReplicateKey] = useState('');
  const [localFalKey, setLocalFalKey] = useState('');

  // Extract keys from globalSettings or localStorage as fallback
  const activeReplicateKey =
    globalSettings?.replicateKey ||
    (localStorage.getItem('tts_settings')
      ? JSON.parse(localStorage.getItem('tts_settings')).replicateKey
      : '') ||
    '';

  const activeFalKey =
    globalSettings?.falKey ||
    (localStorage.getItem('tts_settings')
      ? JSON.parse(localStorage.getItem('tts_settings')).falKey
      : '') ||
    '';

  useEffect(() => {
    // Sync local keys with stored keys on mount
    setLocalReplicateKey(localStorage.getItem('user_replicate_key') || activeReplicateKey || '');
    setLocalFalKey(localStorage.getItem('user_fal_key') || activeFalKey || '');
    setOutputDir(localStorage.getItem('character_animator_output_dir') || '');
  }, [activeReplicateKey, activeFalKey]);

  const handleReplicateKeyChange = (val) => {
    setLocalReplicateKey(val);
    localStorage.setItem('user_replicate_key', val);
  };

  const handleFalKeyChange = (val) => {
    setLocalFalKey(val);
    localStorage.setItem('user_fal_key', val);
  };

  const handleImageUpload = (file) => {
    const filePath = file.path || '';
    const reader = new FileReader();
    reader.onload = () => {
      setCharacterImage({
        file,
        base64: reader.result,
        previewUrl: URL.createObjectURL(file),
        path: filePath,
      });
    };
    reader.readAsDataURL(file);
    return false; // Prevent auto-upload
  };

  const handleVideoUpload = (file) => {
    const filePath = file.path || '';
    setDrivingVideo({
      file,
      path: filePath,
      previewUrl: URL.createObjectURL(file),
      isPreset: false,
      presetUrl: '',
    });
    return false; // Prevent auto-upload
  };

  const handleSelectPreset = (key) => {
    const preset = PRESET_VIDEOS.find((p) => p.key === key);
    if (preset) {
      setDrivingVideo({
        file: null,
        path: '',
        previewUrl: preset.url,
        isPreset: true,
        presetUrl: preset.url,
        label: preset.label,
      });
      // Auto adjust mode if needed
      if (preset.type === 'face' && mode === 'body') {
        setMode('face');
      } else if (preset.type === 'body' && mode === 'face') {
        setMode('body');
      }
    }
  };

  const selectOutputDir = async () => {
    if (window.electron && window.electron.selectDirectory) {
      const dir = await window.electron.selectDirectory();
      if (dir) {
        setOutputDir(dir);
        localStorage.setItem('character_animator_output_dir', dir);
      }
    }
  };

  const startAnimationProcess = async () => {
    const finalReplicateKey = localReplicateKey || activeReplicateKey;
    const finalFalKey = localFalKey || activeFalKey;

    if (engine === 'fal' && !finalFalKey) {
      message.warning('Vui lòng điền Fal.ai API Key.');
      return;
    }
    if (engine === 'replicate' && !finalReplicateKey) {
      message.warning('Vui lòng điền Replicate API Key.');
      return;
    }
    if (!characterImage) {
      message.warning('Vui lòng tải lên ảnh nhân vật mẫu.');
      return;
    }
    if (!drivingVideo) {
      message.warning('Vui lòng chọn hoặc tải lên video hành động/khẩu hình mẫu.');
      return;
    }
    // Only require output directory on desktop
    const isElectron = window.electron && !window.electron.isWebMock;
    if (isElectron && !outputDir) {
      message.warning('Vui lòng chọn thư mục để lưu video kết quả.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    setResultVideoPath('');
    setProgressPercent(5);
    setProgressText('Đang khởi tạo tiến trình...');
    
    // Setup initial logs
    const initialLogs = [
      { id: 1, text: 'Chuẩn bị dữ liệu và kiểm tra cấu hình', status: 'loading' },
      { id: 2, text: 'Tải tài nguyên hình ảnh & video lên đám mây tạm thời', status: 'pending' },
      { id: 3, text: `Gửi tác vụ tạo chuyển động đến ${engine === 'fal' ? 'Fal.ai' : 'Replicate'} GPU API`, status: 'pending' },
      { id: 4, text: 'Biên dịch video cuối cùng và đồng bộ âm thanh', status: 'pending' },
    ];
    setProcessLogs(initialLogs);

    try {
      // Step 1: File preparation
      setProcessLogs(prev => prev.map(l => l.id === 1 ? { ...l, status: 'done' } : l.id === 2 ? { ...l, status: 'loading' } : l));
      setProgressPercent(20);
      setProgressText('Đang xử lý tải lên các tệp tin...');

      let response;

      if (isElectron) {
        // Desktop Mode (Electron)
        const imagePath = characterImage.path;
        if (!imagePath) {
          throw new Error('Không lấy được đường dẫn ảnh cục bộ. Vui lòng kéo thả lại ảnh.');
        }

        const videoPath = drivingVideo.isPreset ? drivingVideo.presetUrl : drivingVideo.path;
        if (!videoPath) {
          throw new Error('Không lấy được đường dẫn video cục bộ. Vui lòng kéo thả lại video.');
        }

        setProcessLogs(prev => prev.map(l => l.id === 2 ? { ...l, status: 'done' } : l.id === 3 ? { ...l, status: 'loading' } : l));
        setProgressPercent(45);
        setProgressText(`Gửi tác vụ xử lý đến máy chủ GPU ${engine === 'fal' ? 'Fal.ai' : 'Replicate'}...`);

        response = await window.electron.aiCharacterAnimate({
          imagePath,
          videoPath,
          engine,
          falKey: finalFalKey,
          replicateKey: finalReplicateKey,
          mode,
          outputDir,
          index: Date.now(),
        });
      } else {
        // Web Mode (Hugging Face / Browser)
        const formData = new FormData();
        formData.append('image', characterImage.file);
        
        if (drivingVideo.isPreset) {
          formData.append('presetVideoUrl', drivingVideo.presetUrl);
        } else {
          formData.append('video', drivingVideo.file);
        }
        
        formData.append('mode', mode);
        formData.append('engine', engine);
        formData.append('replicateKey', finalReplicateKey);
        formData.append('falKey', finalFalKey);

        setProcessLogs(prev => prev.map(l => l.id === 2 ? { ...l, status: 'done' } : l.id === 3 ? { ...l, status: 'loading' } : l));
        setProgressPercent(40);
        setProgressText('Đang truyền dữ liệu lên máy chủ Web (Hugging Face)...');

        const fetchUrl = `${BASE_URL_API}/api/character-animate`;
        const res = await fetch(fetchUrl, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Lỗi không xác định từ máy chủ' }));
          throw new Error(errData.error || `Lỗi máy chủ (Mã lỗi ${res.status})`);
        }

        const resData = await res.json();
        response = {
          ok: true,
          filePath: `${BASE_URL_API}${resData.url}`,
        };
      }

      if (!response.ok) {
        throw new Error(response.error || 'Lỗi không xác định trong quá trình sinh video.');
      }

      setProcessLogs(prev => prev.map(l => l.id === 3 ? { ...l, status: 'done' } : l.id === 4 ? { ...l, status: 'done' } : l));
      setProgressPercent(100);
      setProgressText('Đã hoàn tất tạo video thành công!');
      setResultVideoPath(response.filePath);
      message.success('Đã tạo chuyển động nhân vật thành công!');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setProcessLogs(prev => prev.map(l => l.status === 'loading' ? { ...l, status: 'error' } : l));
      message.error(`Tạo video thất bại: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShowInFolder = () => {
    if (resultVideoPath && isElectron && window.electron.showItemInFolder) {
      window.electron.showItemInFolder(resultVideoPath);
    }
  };

  const handleDownloadWebVideo = () => {
    if (resultVideoPath) {
      const link = document.createElement('a');
      link.href = resultVideoPath;
      link.download = `character_animate_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getVideoSrc = () => {
    if (!resultVideoPath) return '';
    if (resultVideoPath.startsWith('http://') || resultVideoPath.startsWith('https://')) {
      return resultVideoPath;
    }
    return `media://${resultVideoPath.replace(/\\/g, '/')}`;
  };

  return (
    <div className="character-animator-container">
      <div className="header-section">
        <div>
          <h2>Tạo Chuyển Động Nhân Vật (AI Character Animator)</h2>
          <p className="subtitle">
            Biến bức ảnh tĩnh của bạn thành video sống động bằng cách sao chép chuyển động hoặc biểu cảm từ video mẫu.
          </p>
        </div>
      </div>

      <Row gutter={[20, 20]} className="animator-grid-row">
        {/* Left column - Inputs */}
        <Col xs={24} lg={12}>
          <Card
            title="1. Cấu hình đầu vào & Thuật toán"
            bordered={false}
            className="card-custom"
          >
            {/* GPU Engine Selector */}
            <div className="section-group">
              <label className="section-label">Lựa chọn GPU Engine</label>
              <Radio.Group
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
                buttonStyle="solid"
              >
                <Radio.Button value="fal" style={{ width: '50%', textAlign: 'center', borderRadius: '8px 0 0 8px' }}>
                  Fal.ai Engine (Nhanh 2s)
                </Radio.Button>
                <Radio.Button value="replicate" style={{ width: '50%', textAlign: 'center', borderRadius: '0 8px 8px 0' }}>
                  Replicate Engine (Ổn định)
                </Radio.Button>
              </Radio.Group>
            </div>

            {/* API Key configuration */}
            {engine === 'fal' ? (
              <div className="section-group">
                <label className="section-label">Cấu hình Fal.ai API Key</label>
                <Input.Password
                  prefix={<KeyOutlined style={{ color: '#0d9488' }} />}
                  placeholder="Nhập Fal.ai API Key (fal_...)"
                  value={localFalKey}
                  onChange={(e) => handleFalKeyChange(e.target.value)}
                  className="custom-input"
                />
                <span className="hint-text">
                  Key sẽ được lưu trữ cục bộ trên máy của bạn để bảo mật.
                </span>
              </div>
            ) : (
              <div className="section-group">
                <label className="section-label">Cấu hình Replicate API Token</label>
                <Input.Password
                  prefix={<KeyOutlined style={{ color: '#0d9488' }} />}
                  placeholder="Nhập Replicate API Token (r8_...)"
                  value={localReplicateKey}
                  onChange={(e) => handleReplicateKeyChange(e.target.value)}
                  className="custom-input"
                />
                <span className="hint-text">
                  Token sẽ được lưu trữ cục bộ trên máy của bạn để bảo mật.
                </span>
              </div>
            )}

            {/* Character Image */}
            <div className="section-group">
              <label className="section-label">Ảnh Nhân Vật Mẫu</label>
              <Dragger
                accept="image/*"
                multiple={false}
                beforeUpload={handleImageUpload}
                showUploadList={false}
                className="dragger-custom"
              >
                {characterImage ? (
                  <div className="preview-container">
                    <img
                      src={characterImage.previewUrl}
                      alt="Character"
                      className="model-preview"
                    />
                    <div className="upload-overlay">
                      <PictureOutlined /> Thay đổi ảnh chân dung
                    </div>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <PictureOutlined className="upload-icon" />
                    <p>Kéo thả hoặc nhấp để tải lên ảnh nhân vật</p>
                    <span className="hint-text">Định dạng JPG, PNG. Ảnh chân dung rõ mặt hoặc ảnh đứng thẳng.</span>
                  </div>
                )}
              </Dragger>
            </div>

            {/* Template Selection */}
            <div className="section-group">
              <label className="section-label">Chọn Video Chuyển Động / Khẩu Hình Mẫu</label>
              
              {/* Visual preset cards */}
              <div className="preset-grid">
                {PRESET_VIDEOS.map((preset) => {
                  const isSelected = drivingVideo?.isPreset && drivingVideo.presetUrl === preset.url;
                  return (
                    <div
                      key={preset.key}
                      className={`preset-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectPreset(preset.key)}
                    >
                      <div className="preset-icon">
                        {preset.type === 'face' ? '🗣️' : '💃'}
                      </div>
                      <div className="preset-meta">
                        <div className="preset-title">{preset.label}</div>
                        <div className="preset-desc">{preset.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ textAlign: 'center', margin: '14px 0 8px 0' }}>
                <span className="or-text">— HOẶC TẢI LÊN VIDEO MẪU RIÊNG —</span>
              </div>

              <Dragger
                accept="video/*"
                multiple={false}
                beforeUpload={handleVideoUpload}
                showUploadList={false}
                className="dragger-custom"
              >
                {drivingVideo && !drivingVideo.isPreset ? (
                  <div className="preview-container text-center" style={{ height: 100 }}>
                    <PlayCircleOutlined className="upload-icon" style={{ fontSize: 24 }} />
                    <p className="file-name-text" style={{ maxWidth: '80%', margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {drivingVideo.file?.name || 'Video cục bộ'}
                    </p>
                    <div className="upload-overlay">
                      <UploadOutlined /> Đổi Video Khác
                    </div>
                  </div>
                ) : (
                  <div className="upload-placeholder" style={{ padding: '16px 12px' }}>
                    <UploadOutlined className="upload-icon" style={{ fontSize: 20 }} />
                    <p>Kéo thả video của bạn vào đây</p>
                  </div>
                )}
              </Dragger>
            </div>

            {/* AI Algorithm Mode */}
            <div className="section-group">
              <label className="section-label">
                Thuật Toán Sinh Video{' '}
                <Tooltip title="Chế độ Pipeline (Kết hợp) sẽ chạy MimicMotion để chuyển động thân hình, sau đó dùng LivePortrait để làm sắc nét khuôn mặt và nhép miệng theo nhạc.">
                  <InfoCircleOutlined style={{ color: '#0d9488', marginLeft: 4 }} />
                </Tooltip>
              </label>
              <div className="radio-group-wrapper">
                <Radio.Group
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  style={{ width: '100%' }}
                  buttonStyle="solid"
                >
                  <Row gutter={[8, 8]}>
                    <Col span={24}>
                      <Radio.Button value="pipeline" style={{ width: '100%', borderRadius: 8 }}>
                        ✨ Pipeline Kết hợp (Body + Face) - Khuyên dùng thương mại
                      </Radio.Button>
                    </Col>
                    <Col span={12}>
                      <Radio.Button value="body" style={{ width: '100%', borderRadius: 8 }}>
                        💃 Chỉ body (MimicMotion)
                      </Radio.Button>
                    </Col>
                    <Col span={12}>
                      <Radio.Button value="face" style={{ width: '100%', borderRadius: 8 }}>
                        🗣️ Chỉ mặt & hát (LivePortrait)
                      </Radio.Button>
                    </Col>
                  </Row>
                </Radio.Group>
              </div>
            </div>

            {/* Output Directory (Desktop Only) */}
            {isElectron && (
              <div className="section-group">
                <label className="section-label">Thư Mục Lưu Kết Quả</label>
                <div className="dir-selector">
                  <Input
                    value={outputDir}
                    placeholder="Chưa chọn thư mục..."
                    readOnly
                    className="dir-input"
                  />
                  <Button
                    onClick={selectOutputDir}
                    icon={<FolderOpenOutlined />}
                    title="Chọn thư mục"
                  />
                </div>
              </div>
            )}

            <Button
              type="primary"
              size="large"
              block
              onClick={startAnimationProcess}
              loading={isProcessing}
              className="start-btn"
              style={{ marginTop: 12 }}
            >
              {isProcessing ? 'HỆ THỐNG ĐANG XỬ LÝ (XIN VUI LÒNG ĐỢI)...' : 'BẮT ĐẦU TẠO VIDEO'}
            </Button>
          </Card>
        </Col>

        {/* Right column - Process Visualizer */}
        <Col xs={24} lg={12}>
          <Card
            title="2. Kết Quả Sản Xuất"
            bordered={false}
            className="card-custom height-full"
          >
            {isProcessing && (
              <div className="processing-container">
                <div className="spinner-wrapper">
                  <LoadingOutlined className="spinner-icon" />
                </div>
                <h3>Đang xử lý tác vụ...</h3>
                <p className="status-text">{progressText}</p>
                <div style={{ width: '85%', margin: '0 auto 24px auto' }}>
                  <Progress
                    percent={progressPercent}
                    status="active"
                    strokeColor={{ '0%': '#0d9488', '100%': '#0f766e' }}
                  />
                </div>

                {/* Interactive logs timeline */}
                <div className="process-logs-list">
                  {processLogs.map((log) => (
                    <div key={log.id} className={`log-item ${log.status}`}>
                      <span className="log-status-icon">
                        {log.status === 'done' && '✓'}
                        {log.status === 'loading' && <LoadingOutlined />}
                        {log.status === 'pending' && '○'}
                        {log.status === 'error' && '✗'}
                      </span>
                      <span className="log-text">{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isProcessing && resultVideoPath && (
              <div className="result-container">
                <div className="success-banner">
                  <CheckCircleOutlined className="success-icon" />
                  <h3>Tạo Video Thành Công!</h3>
                  <p>
                    {isElectron
                      ? 'Video đã được xuất ra và lưu trữ thành công.'
                      : 'Video đã được sinh thành công trên máy chủ.'}
                  </p>
                </div>

                <div className="video-player-wrapper">
                  <video
                    src={getVideoSrc()}
                    controls
                    autoPlay
                    loop
                    className="result-video-player"
                  />
                </div>

                <div className="path-display">
                  <strong>Thông tin file kết quả:</strong>
                  <div className="path-text" title={resultVideoPath}>
                    {resultVideoPath}
                  </div>
                </div>

                <Space size="middle" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
                  {isElectron ? (
                    <Button
                      type="primary"
                      icon={<FolderOpenOutlined />}
                      onClick={handleShowInFolder}
                      className="action-btn-primary"
                    >
                      Hiển thị trong thư mục
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={handleDownloadWebVideo}
                      className="action-btn-primary"
                    >
                      Tải xuống Video
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setResultVideoPath('');
                      setErrorMsg('');
                    }}
                  >
                    Tạo video mới
                  </Button>
                </Space>
              </div>
            )}

            {!isProcessing && errorMsg && (
              <div className="error-container">
                <CloseCircleOutlined className="error-icon" />
                <h3>Tác Vụ Thất Bại</h3>
                <Alert
                  message="Lỗi trả về từ hệ thống AI"
                  description={errorMsg}
                  type="error"
                  showIcon
                  style={{ textAlign: 'left', width: '100%' }}
                />
                <Button
                  type="primary"
                  danger
                  style={{ marginTop: 20 }}
                  onClick={() => setErrorMsg('')}
                >
                  Quay lại và thiết lập lại
                </Button>
              </div>
            )}

            {!isProcessing && !resultVideoPath && !errorMsg && (
              <div className="empty-container">
                <PlayCircleOutlined className="empty-icon" />
                <h3>Hệ thống Sẵn Sàng</h3>
                <p>
                  Chọn cấu hình nhân vật mẫu và mẫu chuyển động ở cột trái, sau đó bấm nút khởi động để bắt đầu tạo video.
                </p>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CharacterAnimator;
