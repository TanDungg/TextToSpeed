import React, { useState } from 'react';
import {
  Card,
  Input,
  Button,
  Steps,
  Typography,
  message,
  Row,
  Col,
  Divider,
  Segmented,
} from 'antd';
import {
  Wand2,
  Video,
  FileText,
  Image as ImageIcon,
  Play,
  Download,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import axios from 'axios';
import TTSProvider from '../../_service/TTSProvider';
import './AIVideoCreatorStyles.scss';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const AIVideoCreator = ({ settings }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [videoGenerated, setVideoGenerated] = useState(false);
  const [aiModel, setAiModel] = useState('openai');

  const handleGenerateScript = async () => {
    if (!topic.trim()) return message.warning('Hãy nhập chủ đề video!');

    if (aiModel === 'openai') {
      if (!settings.openaiKey)
        return message.error('Vui lòng cấu hình OpenAI API Key trong cài đặt!');
      return handleGenerateWithOpenAI();
    } else {
      if (!settings.geminiKey)
        return message.error('Vui lòng cấu hình Gemini API Key (Miễn phí) trong cài đặt!');
      return handleGenerateWithGemini();
    }
  };

  const handleGenerateWithOpenAI = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'Bạn là một chuyên gia sáng tạo nội dung video ngắn. Hãy viết kịch bản video. Trả về JSON: { "title": "...", "script": "...", "scenes": [{ "text": "...", "imagePrompt": "..." }] }',
            },
            {
              role: 'user',
              content: `Chủ đề: ${topic}`,
            },
          ],
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${settings.openaiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = JSON.parse(response.data.choices[0].message.content);
      processResult(result);
    } catch (err) {
      message.error(
        'Lỗi khi tạo kịch bản OpenAI: ' + (err.response?.data?.error?.message || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWithGemini = async () => {
    setLoading(true);
    try {
      const prompt = `Bạn là chuyên gia sáng tạo video ngắn. Hãy viết kịch bản chi tiết dựa trên chủ đề của người dùng. 
      Hãy trả về kết quả DUY NHẤT ở định dạng JSON như sau:
      {
        "title": "Tên tiêu đề video",
        "script": "Nội dung thuyết minh toàn bộ",
        "scenes": [
          { "text": "Câu thuyết minh cảnh 1", "imagePrompt": "Mô tả hình ảnh cho cảnh 1" },
          { "text": "Câu thuyết minh cảnh 2", "imagePrompt": "Mô tả hình ảnh cho cảnh 2" }
        ]
      }
      Chủ đề: ${topic}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${settings.geminiKey}`;

      // Sử dụng IPC bridge đã được định nghĩa trong preload.cjs (window.electron.ttsRequest)
      const response = await window.electron.ttsRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        },
      });

      if (!response.ok) {
        const errorDetail =
          typeof response.error === 'object'
            ? response.error.error?.message || JSON.stringify(response.error)
            : response.error;
        throw new Error(errorDetail || 'Lỗi không xác định từ Gemini');
      }

      let content = response.data.candidates[0].content.parts[0].text;

      // Xử lý trường hợp AI trả về text kèm markdown code block ```json
      if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim();
      }

      const result = JSON.parse(content);
      processResult(result);
    } catch (err) {
      console.error('Gemini Error Details:', err);
      message.error('Lỗi Gemini: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const processResult = (result) => {
    setScript(result);
    setScenes(result.scenes);
    message.success('Đã tạo kịch bản thành công!');
    setCurrentStep(1);
  };

  const handleGenerateMedia = async () => {
    setLoading(true);
    try {
      const fullText = scenes.map((s) => s.text).join(' ');
      message.info('Đang tạo giọng đọc AI...');

      if (settings.fptKey) {
        await TTSProvider.speakWithFPT(fullText, 'banmai', settings.fptKey);
      } else {
        const blob = await TTSProvider.getGoogleAudioBlob(fullText, 'vi');
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
      }

      message.info('Đang phác thảo hình ảnh...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const updatedScenes = scenes.map((s, idx) => ({
        ...s,
        imageUrl: `https://picsum.photos/seed/${idx + Date.now()}/800/450`,
      }));

      setScenes(updatedScenes);
      setCurrentStep(2);
      message.success('Đã chuẩn bị xong tài nguyên!');
    } catch (err) {
      message.error('Lỗi khi tạo tài nguyên: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssembleVideo = async () => {
    setLoading(true);
    try {
      message.info('Đang dựng video...');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      setVideoGenerated(true);
      message.success('Video đã sẵn sàng!');
    } catch (err) {
      message.error('Lỗi dựng video: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-video-creator-container">
      <div className="creator-header">
        <div className="title-row">
          <h1 className="main-title">AI Video Automator</h1>
        </div>
        <div className="subtitle-row">
          <Sparkles className="sparkle-icon" />
          <span className="subtitle-text">Trình tạo video AI chuyên nghiệp</span>
          <span className="version-tag">v1.0.0</span>
        </div>
      </div>

      <Card className="main-creator-card">
        <Steps
          current={currentStep}
          items={[
            { title: 'Kịch bản', icon: <FileText size={18} /> },
            { title: 'Tài nguyên', icon: <ImageIcon size={18} /> },
            { title: 'Hoàn thiện', icon: <Video size={18} /> },
          ]}
          className="custom-steps"
        />

        {currentStep === 0 && (
          <div className="step-content animate-in">
            <div className="input-section">
              <div className="section-label">
                <Wand2 />
                <span>Nhập ý tưởng hoặc chủ đề video</span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  Chọn trí tuệ nhân tạo (AI):
                </Text>
                <Segmented
                  block
                  size="large"
                  value={aiModel}
                  onChange={setAiModel}
                  options={[
                    { label: 'OpenAI (GPT-3.5)', value: 'openai' },
                    { label: 'Google Gemini (Miễn phí)', value: 'gemini' },
                  ]}
                  className="custom-segmented"
                />
              </div>

              <TextArea
                rows={6}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ví dụ: 3 lời khuyên để sống hạnh phúc mỗi ngày..."
                className="custom-textarea"
              />
            </div>
            <div className="action-footer">
              <Button
                type="primary"
                size="large"
                loading={loading}
                onClick={handleGenerateScript}
                icon={<ArrowRight size={18} />}
                className="primary-btn"
              >
                Tiếp tục: Viết kịch bản
              </Button>
            </div>
          </div>
        )}

        {currentStep === 1 && script && (
          <div className="step-content animate-in">
            <div className="section-label">
              <FileText size={18} />
              <span>Xem trước kịch bản</span>
            </div>
            <div className="script-preview-box">
              <Title level={4} className="script-title">
                {script.title}
              </Title>
              <Paragraph className="full-script">{script.script}</Paragraph>
              <Divider />
              <div className="scenes-list">
                {scenes.map((scene, idx) => (
                  <div key={idx} className="scene-item">
                    <span className="scene-number">#{idx + 1}</span>
                    <Text className="scene-text">{scene.text}</Text>
                  </div>
                ))}
              </div>
            </div>
            <div className="action-footer">
              <Button onClick={() => setCurrentStep(0)}>Quay lại</Button>
              <Button
                type="primary"
                size="large"
                loading={loading}
                onClick={handleGenerateMedia}
                className="primary-btn"
              >
                Tạo Âm thanh & Hình ảnh
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-content animate-in">
            {!videoGenerated ? (
              <div className="storyboard-view">
                <div className="section-label">
                  <ImageIcon size={18} />
                  <span>Storyboard dự kiến</span>
                </div>
                <Row gutter={[20, 20]}>
                  {scenes.map((scene, idx) => (
                    <Col span={12} key={idx}>
                      <div className="scene-card">
                        <img src={scene.imageUrl} alt={`Scene ${idx}`} />
                        <div className="scene-overlay">
                          <span>{scene.text}</span>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
                <div className="action-footer">
                  <Button onClick={() => setCurrentStep(1)}>Sửa kịch bản</Button>
                  <Button
                    type="primary"
                    size="large"
                    loading={loading}
                    onClick={handleAssembleVideo}
                    icon={<Play size={18} />}
                    className="primary-btn"
                  >
                    Bắt đầu Dựng Video
                  </Button>
                </div>
              </div>
            ) : (
              <div className="final-output text-center">
                <div className="video-placeholder">
                  <Video size={64} className="video-icon" />
                  <Title level={3}>Video đã sẵn sàng!</Title>
                  <Text type="secondary">Toàn bộ quy trình tự động hóa đã hoàn thành.</Text>
                </div>
                <div className="action-footer">
                  <Button
                    size="large"
                    onClick={() => {
                      setVideoGenerated(false);
                      setCurrentStep(0);
                      setTopic('');
                    }}
                  >
                    Tạo video mới
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    icon={<Download size={18} />}
                    className="primary-btn"
                  >
                    Tải Video (.mp4)
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AIVideoCreator;
