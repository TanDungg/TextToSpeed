import { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Select,
  Card,
  Upload,
  Table,
  Progress,
  Space,
  Alert,
  Tag,
  Modal,
  Row,
  Col,
  App,
} from 'antd';
import {
  FolderOpenOutlined,
  UploadOutlined,
  PlayCircleOutlined,
  PictureOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import './BatchImageGeneratorStyles.scss';

const { Option } = Select;

const BatchImageGenerator = ({ globalSettings }) => {
  const { message } = App.useApp();
  const [modelImage, setModelImage] = useState(null); // { file, base64, previewUrl }
  const [products, setProducts] = useState([]); // Array of { id, name, file, base64, previewUrl, status, prompt, imageResult, videoResult, error }
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessIndex, setCurrentProcessIndex] = useState(-1);
  const [outputDir, setOutputDir] = useState('');

  const [poseImage, setPoseImage] = useState(null); // { file, base64, previewUrl }
  const [bgImage, setBgImage] = useState(null); // { file, base64, previewUrl }
  const [customImagePrompt, setCustomImagePrompt] = useState('');

  // Extract keys from globalSettings prop (falling back to localStorage if not passed)
  const activeOpenaiKey =
    globalSettings?.openaiKey ||
    (localStorage.getItem('tts_settings')
      ? JSON.parse(localStorage.getItem('tts_settings')).openaiKey
      : '') ||
    '';
  const activeGeminiKey =
    globalSettings?.geminiKey ||
    (localStorage.getItem('tts_settings')
      ? JSON.parse(localStorage.getItem('tts_settings')).geminiKey
      : '') ||
    '';
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

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('batch_gen_settings');
    const initialSettings = saved ? JSON.parse(saved) : {};

    let geminiModel = initialSettings.geminiModel || 'gemini-2.5-flash';
    if (geminiModel.startsWith('gemini-1.')) {
      geminiModel = 'gemini-2.5-flash';
    }

    return {
      promptProvider: initialSettings.promptProvider || 'gemini',
      geminiModel: geminiModel,
      imagenModel: initialSettings.imagenModel || 'imagen-3.0-generate-002',
      videoProvider: initialSettings.videoProvider || 'google',
      videoModel: initialSettings.videoModel || 'veo-2.0-generate-001',
      motionPrompt:
        initialSettings.motionPrompt ||
        'slow camera zoom, wind blowing hair gently, realistic physics, 4k cinematic',
    };
  });

  const [motionPrompt, setMotionPrompt] = useState(settings.motionPrompt);

  useEffect(() => {
    setSettings((prev) => {
      if (prev.motionPrompt === motionPrompt) return prev;
      return { ...prev, motionPrompt };
    });
  }, [motionPrompt]);

  useEffect(() => {
    setMotionPrompt((prev) => {
      if (prev === settings.motionPrompt) return prev;
      return settings.motionPrompt;
    });
  }, [settings.motionPrompt]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [checkingModels, setCheckingModels] = useState(false);
  const [supportedModels, setSupportedModels] = useState(() => {
    const saved = localStorage.getItem('supported_gemini_models');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const saved = localStorage.getItem('supported_gemini_models');
    setSupportedModels(saved ? JSON.parse(saved) : null);
  }, [activeGeminiKey]);

  useEffect(() => {
    localStorage.setItem('batch_gen_settings', JSON.stringify(settings));
  }, [settings]);

  const getPromptModelsList = () => {
    const defaultModels = [
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Tốc độ cao)' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Độ chính xác cao)' },
    ];

    if (!supportedModels) return defaultModels;

    const filtered = supportedModels.filter(
      (m) =>
        m.startsWith('gemini-') &&
        !m.includes('gemini-1.') &&
        !m.includes('embedding') &&
        !m.includes('image')
    );

    if (filtered.length === 0) return defaultModels;

    return filtered.map((m) => {
      let label = m;
      if (m === 'gemini-2.0-flash') label += ' (Tốc độ cao)';
      else if (m === 'gemini-2.5-flash') label += ' (Mới - Khuyên dùng)';
      else if (m === 'gemini-3.5-flash') label += ' (Mới nhất)';
      return { value: m, label };
    });
  };

  const getImagenModelsList = () => {
    const defaultModels = [
      { value: 'imagen-3.0-generate-002', label: 'Imagen 3.0 (Mặc định)' },
      { value: 'imagen-4.0-generate-001', label: 'Imagen 4.0 Standard' },
      { value: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4.0 Ultra (Độ phân giải siêu cao)' },
      { value: 'imagen-4.0-fast-generate-001', label: 'Imagen 4.0 Fast (Tốc độ nhanh)' },
    ];

    if (!supportedModels) return defaultModels;

    const filtered = supportedModels.filter((m) => m.includes('imagen-'));
    if (filtered.length === 0) return defaultModels;

    return filtered.map((m) => {
      let label = m;
      if (m === 'imagen-3.0-generate-002') label += ' (Mặc định)';
      else if (m === 'imagen-4.0-generate-001') label += ' (Chất lượng cao)';
      else if (m === 'imagen-4.0-ultra-generate-001') label += ' (Ultra)';
      else if (m === 'imagen-4.0-fast-generate-001') label += ' (Nhanh)';
      return { value: m, label };
    });
  };

  const getVideoModelsList = () => {
    const defaultModels = [
      { value: 'veo-2.0-generate-001', label: 'Veo 2.0 (Mặc định)' },
      { value: 'veo-3.0-generate-001', label: 'Veo 3.0 Standard' },
      { value: 'veo-3.0-fast-generate-001', label: 'Veo 3.0 Fast' },
    ];

    if (!supportedModels) return defaultModels;

    const filtered = supportedModels.filter((m) => m.includes('veo-'));
    if (filtered.length === 0) return defaultModels;

    return filtered.map((m) => {
      let label = m;
      if (m === 'veo-2.0-generate-001') label += ' (Mặc định)';
      else if (m === 'veo-3.0-generate-001') label += ' (Chất lượng cao)';
      else if (m === 'veo-3.0-fast-generate-001') label += ' (Nhanh)';
      return { value: m, label };
    });
  };

  // Load default output directory (downloads folder or similar)
  useEffect(() => {
    // We can request a default path from Electron or let user pick.
    setOutputDir(localStorage.getItem('batch_gen_output_dir') || '');
  }, []);

  const selectOutputDir = async () => {
    if (window.electron && window.electron.selectDirectory) {
      const dir = await window.electron.selectDirectory();
      if (dir) {
        setOutputDir(dir);
        localStorage.setItem('batch_gen_output_dir', dir);
      }
    }
  };

  const checkSupportedModels = async () => {
    const key = activeGeminiKey;
    if (!key) {
      message.warning('Vui lòng cấu hình Gemini API Key trong phần Cài đặt hệ thống trước.');
      return;
    }
    setCheckingModels(true);
    setSupportedModels(null);
    try {
      const result = await window.electron.listGeminiModels(key);
      if (result.ok && result.models) {
        const modelNames = result.models.map((m) => m.name.replace('models/', ''));
        setSupportedModels(modelNames);
        localStorage.setItem('supported_gemini_models', JSON.stringify(modelNames));
        message.success('Kiểm tra Key thành công! Đã tải danh sách mô hình.');

        // Tự động kiểm tra và chuyển sang mô hình Gemini phù hợp nếu mô hình hiện tại không được hỗ trợ
        const textModels = modelNames.filter(
          (m) =>
            m.startsWith('gemini-') &&
            !m.includes('gemini-1.') &&
            !m.includes('embedding') &&
            !m.includes('image')
        );
        if (textModels.length > 0) {
          if (!textModels.includes(settings.geminiModel)) {
            let recommendedGemini = '';
            if (textModels.includes('gemini-2.5-flash')) recommendedGemini = 'gemini-2.5-flash';
            else if (textModels.includes('gemini-2.0-flash'))
              recommendedGemini = 'gemini-2.0-flash';
            else if (textModels.includes('gemini-3.5-flash'))
              recommendedGemini = 'gemini-3.5-flash';
            else recommendedGemini = textModels[0];

            setSettings((prev) => ({ ...prev, geminiModel: recommendedGemini }));
            message.info(`Đã tự động chuyển đổi mô hình Gemini sang: ${recommendedGemini}`);
          }
        }

        // Tự động chuyển đổi mô hình Imagen phù hợp
        const imagenModels = modelNames.filter((m) => m.includes('imagen-'));
        if (imagenModels.length > 0 && !imagenModels.includes(settings.imagenModel)) {
          let recommendedImagen = '';
          if (imagenModels.includes('imagen-4.0-generate-001'))
            recommendedImagen = 'imagen-4.0-generate-001';
          else if (imagenModels.includes('imagen-3.0-generate-002'))
            recommendedImagen = 'imagen-3.0-generate-002';
          else recommendedImagen = imagenModels[0];

          setSettings((prev) => ({ ...prev, imagenModel: recommendedImagen }));
        }

        // Tự động chuyển đổi mô hình Veo phù hợp
        const veoModels = modelNames.filter((m) => m.includes('veo-'));
        if (veoModels.length > 0 && !veoModels.includes(settings.videoModel)) {
          let recommendedVeo = '';
          if (veoModels.includes('veo-3.0-generate-001')) recommendedVeo = 'veo-3.0-generate-001';
          else if (veoModels.includes('veo-2.0-generate-001'))
            recommendedVeo = 'veo-2.0-generate-001';
          else recommendedVeo = veoModels[0];

          setSettings((prev) => ({ ...prev, videoModel: recommendedVeo }));
        }
      } else {
        throw new Error(result.error || 'Không thể lấy danh sách mô hình. Kiểm tra lại API Key.');
      }
    } catch (err) {
      message.error(`Lỗi kiểm tra Key: ${err.message}`);
    } finally {
      setCheckingModels(false);
    }
  };

  const handleModelUpload = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setModelImage({
        file,
        base64: reader.result,
        previewUrl: URL.createObjectURL(file),
      });
    };
    reader.readAsDataURL(file);
    return false; // Prevent auto-upload
  };

  const handlePoseUpload = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setPoseImage({
        file,
        base64: reader.result,
        previewUrl: URL.createObjectURL(file),
      });
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleBgUpload = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setBgImage({
        file,
        base64: reader.result,
        previewUrl: URL.createObjectURL(file),
      });
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleProductsUpload = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const item = {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        file: file,
        base64: reader.result,
        previewUrl: URL.createObjectURL(file),
        status: 'pending', // pending, prompt, blending, motion, done, error
        prompt: '',
        imageResult: '',
        videoResult: '',
        error: '',
      };
      setProducts((prev) => [...prev, item]);
    };
    reader.readAsDataURL(file);
    return false; // Prevent auto-upload
  };

  const clearQueue = () => {
    setProducts([]);
    setCurrentProcessIndex(-1);
  };

  const startBatchProcess = async () => {
    if (!modelImage) {
      message.warning('Vui lòng tải lên ảnh nhân vật mẫu (Ảnh 1).');
      return;
    }
    if (products.length === 0) {
      message.warning('Vui lòng tải lên ít nhất một ảnh trang phục cần thử (Ảnh 2).');
      return;
    }
    if (!poseImage) {
      message.warning('Vui lòng tải lên ảnh dáng đứng & bối cảnh mẫu (Ảnh 3).');
      return;
    }
    if (!outputDir) {
      message.warning('Vui lòng chọn thư mục lưu kết quả.');
      return;
    }

    // Check credentials
    if (settings.promptProvider === 'openai' && !activeOpenaiKey) {
      message.warning('Vui lòng điền OpenAI API Key trong phần Cài đặt hệ thống.');
      return;
    }
    if (settings.promptProvider === 'gemini' && !activeGeminiKey) {
      message.warning('Vui lòng điền Gemini API Key trong phần Cài đặt hệ thống.');
      return;
    }
    if (!activeGeminiKey) {
      message.warning(
        'Vui lòng điền Gemini API Key trong phần Cài đặt hệ thống để thực hiện phối ghép ảnh.'
      );
      return;
    }
    if (!activeFalKey) {
      message.warning(
        'Vui lòng điền Fal.ai API Key trong phần Cài đặt hệ thống để sử dụng tính năng thử đồ (VTON).'
      );
      return;
    }

    setIsProcessing(true);

    // Reset statuses of all pending or error items
    setProducts((prev) =>
      prev.map((p) => (p.status === 'done' ? p : { ...p, status: 'pending', error: '' }))
    );

    for (let i = 0; i < products.length; i++) {
      if (products[i].status === 'done') continue;

      setCurrentProcessIndex(i);

      try {
        // Step 1: Generate prompt
        setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: 'prompt' } : p)));

        const promptResult = await window.electron.gptGenerateBlendPrompt({
          productImageBase64: products[i].base64,
          modelImageBase64: modelImage.base64,
          poseImageBase64: poseImage.base64,
          bgImageBase64: bgImage ? bgImage.base64 : '',
          customImagePrompt: customImagePrompt,
          apiKey: settings.promptProvider === 'gemini' ? activeGeminiKey : activeOpenaiKey,
          provider: settings.promptProvider,
          geminiModel: settings.geminiModel,
        });

        if (!promptResult.ok) {
          throw new Error(promptResult.error || 'Lỗi tạo prompt phối cảnh');
        }

        const generatedPrompt = promptResult.prompt;
        setProducts((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, prompt: generatedPrompt } : p))
        );

        // Step 2: Blend image (Imagen 3)
        setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: 'blending' } : p)));

        const imageResult = await window.electron.aiGenerateBlendedImage({
          prompt: generatedPrompt,
          geminiKey: activeGeminiKey,
          falKey: activeFalKey,
          outputDir: outputDir,
          index: i,
          modelImageBase64: modelImage.base64,
          productImageBase64: products[i].base64,
          imagenModel: settings.imagenModel,
        });

        if (!imageResult.ok) {
          throw new Error(imageResult.error || 'Lỗi tạo ảnh phối ghép');
        }

        const blendedImagePath = imageResult.filePath;
        setProducts((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, imageResult: blendedImagePath } : p))
        );

        // Step 3: Animate image (Luma / Veo)
        if (settings.videoProvider && settings.videoProvider !== 'none') {
          setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: 'motion' } : p)));

          const videoResult = await window.electron.aiImageToVideo({
            imagePath: blendedImagePath,
            motionPrompt: motionPrompt,
            replicateKey: activeReplicateKey,
            geminiKey: activeGeminiKey,
            provider: settings.videoProvider,
            videoModel: settings.videoModel,
            outputDir: outputDir,
            index: i,
          });

          if (!videoResult.ok) {
            throw new Error(videoResult.error || 'Lỗi tạo chuyển động video');
          }

          setProducts((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: 'done', videoResult: videoResult.filePath } : p
            )
          );
        } else {
          // If no video provider, skip step 3 and mark as done
          setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: 'done' } : p)));
        }
      } catch (err) {
        console.error('Lỗi khi chạy sản phẩm:', err);
        setProducts((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: 'error', error: err.message } : p))
        );
      }
    }

    setIsProcessing(false);
    setCurrentProcessIndex(-1);
    message.success('Đã hoàn thành tiến trình sản xuất hàng loạt!');
  };

  const columns = [
    {
      title: 'Hình ảnh',
      dataIndex: 'previewUrl',
      key: 'previewUrl',
      width: 90,
      render: (url) => <img src={url} alt="product" className="table-thumbnail" />,
    },
    {
      title: 'Tên file',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text) => (
        <div className="file-name-container" title={text}>
          {text}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 150,
      render: (_, record) => {
        switch (record.status) {
          case 'pending':
            return <Tag color="default">Đang chờ</Tag>;
          case 'prompt':
            return (
              <Tag color="blue" icon={<LoadingOutlined />}>
                Prompt...
              </Tag>
            );
          case 'blending':
            return (
              <Tag color="purple" icon={<LoadingOutlined />}>
                Ghép ảnh...
              </Tag>
            );
          case 'motion':
            return (
              <Tag color="orange" icon={<LoadingOutlined />}>
                Tạo video...
              </Tag>
            );
          case 'done':
            return (
              <Tag color="success" icon={<CheckCircleOutlined />}>
                Hoàn tất
              </Tag>
            );
          case 'error':
            return (
              <Tag color="error" icon={<CloseCircleOutlined />}>
                Lỗi
              </Tag>
            );
          default:
            return null;
        }
      },
    },
    {
      title: 'Kết quả / Chi tiết lỗi',
      key: 'results',
      render: (_, record) => {
        const localImgUrl = record.imageResult
          ? (record.imageResult.startsWith('http://') || record.imageResult.startsWith('https://') || record.imageResult.startsWith('/')
            ? record.imageResult
            : `media://${encodeURIComponent(record.imageResult)}`)
          : '';
        const localVidUrl = record.videoResult
          ? (record.videoResult.startsWith('http://') || record.videoResult.startsWith('https://') || record.videoResult.startsWith('/')
            ? record.videoResult
            : `media://${encodeURIComponent(record.videoResult)}`)
          : '';

        return (
          <div className="result-cell-container">
            {record.imageResult && (
              <a
                href={localImgUrl}
                target="_blank"
                rel="noreferrer"
                className="result-link"
                style={{ marginRight: 12 }}
              >
                <PictureOutlined /> Xem ảnh
              </a>
            )}
            {record.videoResult && (
              <a href={localVidUrl} target="_blank" rel="noreferrer" className="result-link">
                <PlayCircleOutlined /> Xem video
              </a>
            )}
            {record.error && (
              <div className="error-text-container" title={record.error}>
                {record.error}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="tool-container batch-generator-container">
      <Card variant="borderless" className="tool-card">
        {isProcessing && (
          <div className="tool-card-overlay">
            <div className="premium-spinner" />
            <div className="tool-card-overlay-text">
              {currentProcessIndex >= 0
                ? `Đang sản xuất sản phẩm thứ ${currentProcessIndex + 1}/${products.length}...`
                : 'Đang bắt đầu sản xuất hàng loạt...'}
            </div>
            <div className="tool-card-overlay-subtext">
              AI đang chạy kết hợp 3 bước: phân tích prompt, sinh ảnh ghép và tạo chuyển động video
              ngắn. Vui lòng giữ ứng dụng mở.
            </div>
            {products.length > 0 && (
              <div className="overlay-progress-container">
                <Progress
                  percent={
                    currentProcessIndex >= 0
                      ? Math.round((currentProcessIndex / products.length) * 100)
                      : 0
                  }
                  strokeColor="#0d9488"
                />
              </div>
            )}
          </div>
        )}
        <header className="tool-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="tool-gradient-title">Sản Xuất Hình Ảnh Hàng Loạt</h1>
              <div className="tool-status-bar">
                <PictureOutlined style={{ color: '#0d9488' }} />
                <span>Ghép sản phẩm lên người mẫu & tạo chuyển động video tự động 3 bước</span>
              </div>
            </div>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setIsSettingsOpen(true)}
              className="settings-btn"
            >
              Cấu hình AI
            </Button>
          </div>
        </header>

        <Row gutter={[32, 32]} className="batch-grid-row">
          {/* Left Side: Upload Panel */}
          <Col xs={24} lg={9} className="batch-controls-panel">
            <Card
              title={
                <Space>
                  <PictureOutlined style={{ color: '#0d9488' }} /> 1. Ảnh nhân vật mẫu (Face/Body)
                </Space>
              }
              className="card-custom"
            >
              <Upload.Dragger
                beforeUpload={handleModelUpload}
                showUploadList={false}
                className="dragger-custom"
                disabled={isProcessing}
              >
                {modelImage ? (
                  <div className="preview-container">
                    <img
                      src={modelImage.previewUrl}
                      alt="Model Template"
                      className="model-preview"
                    />
                    <div className="upload-overlay">
                      <UploadOutlined /> Thay đổi ảnh nhân vật
                    </div>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <UploadOutlined className="upload-icon" />
                    <p>Kéo thả hoặc nhấp để tải ảnh nhân vật mẫu</p>
                  </div>
                )}
              </Upload.Dragger>
            </Card>

            <Card
              title={
                <Space>
                  <UploadOutlined style={{ color: '#0d9488' }} /> 2. Danh sách trang phục hàng loạt
                </Space>
              }
              className="card-custom"
            >
              <Upload
                beforeUpload={handleProductsUpload}
                multiple
                showUploadList={false}
                disabled={isProcessing}
              >
                <Button
                  icon={<UploadOutlined />}
                  type="dashed"
                  block
                  className="upload-btn-dashed"
                  disabled={isProcessing}
                >
                  Chọn nhiều ảnh trang phục
                </Button>
              </Upload>

              {products.length > 0 && (
                <div className="queue-summary">
                  <span>
                    Đã tải lên: <strong>{products.length}</strong> trang phục
                  </span>
                  <Button type="link" danger onClick={clearQueue} disabled={isProcessing}>
                    Xóa danh sách
                  </Button>
                </div>
              )}
            </Card>

            <Card
              title={
                <Space>
                  <PictureOutlined style={{ color: '#0d9488' }} /> 3. Ảnh dáng đứng & bối cảnh mẫu
                </Space>
              }
              className="card-custom"
            >
              <Upload.Dragger
                beforeUpload={handlePoseUpload}
                showUploadList={false}
                className="dragger-custom"
                disabled={isProcessing}
              >
                {poseImage ? (
                  <div className="preview-container">
                    <img src={poseImage.previewUrl} alt="Pose Template" className="model-preview" />
                    <div className="upload-overlay">
                      <UploadOutlined /> Thay đổi ảnh dáng đứng
                    </div>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <UploadOutlined className="upload-icon" />
                    <p>Kéo thả hoặc nhấp để tải dáng đứng & bối cảnh mẫu</p>
                  </div>
                )}
              </Upload.Dragger>
            </Card>

            <Card
              title={
                <Space>
                  <PictureOutlined style={{ color: '#0d9488' }} /> 4. Ảnh bối cảnh tùy chọn (Không
                  bắt buộc)
                </Space>
              }
              className="card-custom"
            >
              <Upload.Dragger
                beforeUpload={handleBgUpload}
                showUploadList={false}
                className="dragger-custom"
                disabled={isProcessing}
              >
                {bgImage ? (
                  <div className="preview-container">
                    <img
                      src={bgImage.previewUrl}
                      alt="Background Template"
                      className="model-preview"
                    />
                    <div className="upload-overlay">
                      <UploadOutlined /> Thay đổi ảnh bối cảnh
                    </div>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <UploadOutlined className="upload-icon" />
                    <p>Trống (Mặc định lấy bối cảnh của Ảnh 3)</p>
                  </div>
                )}
              </Upload.Dragger>
              {bgImage && (
                <Button
                  type="link"
                  danger
                  onClick={() => setBgImage(null)}
                  disabled={isProcessing}
                  style={{ marginTop: '8px', padding: 0 }}
                >
                  Xóa ảnh bối cảnh tùy chọn
                </Button>
              )}
            </Card>

            <Card
              title={
                <Space>
                  <SettingOutlined style={{ color: '#0d9488' }} /> 5. Cấu hình Prompt tùy chọn
                </Space>
              }
              className="card-custom"
            >
              <div className="settings-form" style={{ padding: 0 }}>
                <div className="form-item" style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                    Prompt tạo ảnh bổ sung (Tùy chọn)
                  </label>
                  <Input.TextArea
                    rows={3}
                    placeholder="Mô tả chất liệu, phong cách hoặc ánh sáng bổ sung..."
                    value={customImagePrompt}
                    onChange={(e) => setCustomImagePrompt(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                <div className="form-item" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                    Prompt tạo chuyển động video
                  </label>
                  <Input.TextArea
                    rows={3}
                    placeholder="Ví dụ: slow camera zoom, wind blowing hair..."
                    value={motionPrompt}
                    onChange={(e) => setMotionPrompt(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </Card>

            <Card
              title={
                <Space>
                  <FolderOpenOutlined style={{ color: '#0d9488' }} /> Nơi lưu kết quả
                </Space>
              }
              className="card-custom"
            >
              <div className="dir-selector">
                <Input
                  placeholder="Đường dẫn lưu thư mục kết quả..."
                  value={outputDir}
                  readOnly
                  className="dir-input"
                />
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={selectOutputDir}
                  disabled={isProcessing}
                />
              </div>
            </Card>

            <Button
              type="primary"
              size="large"
              block
              onClick={startBatchProcess}
              loading={isProcessing}
              className="start-btn"
            >
              {isProcessing
                ? `Đang chạy hàng loạt (${currentProcessIndex + 1}/${products.length})`
                : 'BẮT ĐẦU SẢN XUẤT HÀNG LOẠT'}
            </Button>
          </Col>

          {/* Right Side: Status Table Queue */}
          <Col xs={24} lg={15} className="batch-queue-panel">
            <Card title="Hàng đợi sản xuất hình ảnh & video" className="card-custom height-full">
              <Table
                dataSource={products}
                columns={columns}
                rowKey="id"
                pagination={false}
                locale={{ emptyText: 'Chưa có sản phẩm nào trong hàng đợi' }}
                className="queue-table"
                tableLayout="fixed"
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Settings Modal */}
      <Modal
        title={
          <Space>
            <KeyOutlined /> Cấu hình API và Prompt
          </Space>
        }
        open={isSettingsOpen}
        onOk={() => setIsSettingsOpen(false)}
        onCancel={() => setIsSettingsOpen(false)}
        okText="Hoàn thành"
        cancelText="Đóng"
        width={550}
        centered
        className="settings-modal"
      >
        <div className="settings-form">
          <div className="form-item">
            <label>Nguồn tạo prompt (Bước 1)</label>
            <Select
              value={settings.promptProvider}
              onChange={(val) => setSettings({ ...settings, promptProvider: val })}
              style={{ width: '100%' }}
            >
              <Option value="gemini">Google Gemini (Khuyên dùng - Free)</Option>
              <Option value="openai">OpenAI GPT-4o (Trả phí)</Option>
            </Select>
          </div>

          {settings.promptProvider === 'gemini' && (
            <div className="form-item">
              <label>Mô hình Gemini (Tạo Prompt)</label>
              <Select
                value={settings.geminiModel}
                onChange={(val) => setSettings({ ...settings, geminiModel: val })}
                style={{ width: '100%' }}
              >
                {getPromptModelsList().map((m) => (
                  <Option key={m.value} value={m.value}>
                    {m.label}
                  </Option>
                ))}
              </Select>
            </div>
          )}

          {settings.promptProvider === 'gemini' && (
            <div className="form-item">
              <label>Mô hình Imagen (Ghép ảnh - Bước 2)</label>
              <Select
                value={settings.imagenModel}
                onChange={(val) => setSettings({ ...settings, imagenModel: val })}
                style={{ width: '100%' }}
              >
                {getImagenModelsList().map((m) => (
                  <Option key={m.value} value={m.value}>
                    {m.label}
                  </Option>
                ))}
              </Select>
            </div>
          )}

          <div className="form-item">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <label style={{ margin: 0 }}>Các mô hình Gemini/Imagen khả dụng</label>
              <Button
                type="link"
                size="small"
                loading={checkingModels}
                onClick={checkSupportedModels}
                style={{
                  padding: 0,
                  height: 'auto',
                  fontSize: '12px',
                  color: '#0d9488',
                  fontWeight: 600,
                }}
              >
                Kiểm tra & Tải lại
              </Button>
            </div>
            {supportedModels ? (
              <div
                style={{
                  maxHeight: '120px',
                  overflowY: 'auto',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px',
                  background: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {supportedModels.map((m) => (
                    <Tag
                      key={m}
                      style={{
                        margin: 0,
                        fontSize: '11px',
                        borderRadius: '4px',
                        background: 'rgba(13, 148, 136, 0.08)',
                        border: '1px solid rgba(13, 148, 136, 0.2)',
                        color: '#0d9488',
                      }}
                    >
                      {m}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                Bấm "Kiểm tra & Tải lại" để tải các mô hình khả dụng từ Gemini Key của bạn.
              </div>
            )}
          </div>

          <div className="form-item">
            <label>Nguồn tạo video (Bước 3)</label>
            <Select
              value={settings.videoProvider}
              onChange={(val) => setSettings({ ...settings, videoProvider: val })}
              style={{ width: '100%' }}
            >
              <Option value="google">Google Veo (Dùng Gemini Key)</Option>
              <Option value="replicate">Luma Dream Machine (Dùng Replicate Key)</Option>
              <Option value="none">Không tạo video (Chỉ ghép ảnh)</Option>
            </Select>
          </div>

          {settings.videoProvider === 'google' && (
            <div className="form-item">
              <label>Mô hình Google Veo</label>
              <Select
                value={settings.videoModel}
                onChange={(val) => setSettings({ ...settings, videoModel: val })}
                style={{ width: '100%' }}
              >
                {getVideoModelsList().map((m) => (
                  <Option key={m.value} value={m.value}>
                    {m.label}
                  </Option>
                ))}
              </Select>
            </div>
          )}

          <div className="form-item">
            <label>Prompt tạo chuyển động mặc định (Bước 3)</label>
            <Input.TextArea
              rows={3}
              placeholder="Mô tả chuyển động cho video..."
              value={settings.motionPrompt}
              onChange={(e) => setSettings({ ...settings, motionPrompt: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BatchImageGenerator;
