import { useState, useEffect } from 'react';
import { Modal, Form, Input, Switch, Typography, Divider, Alert, Space, Button, Tag, message } from 'antd';
import { KeyOutlined, InfoCircleOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';
import './SettingsModalStyles.scss';

const { Text, Link } = Typography;

const SettingsModal = ({ open, onCancel, settings, onSave }) => {
  const [form] = Form.useForm();
  const [checkingModels, setCheckingModels] = useState(false);
  const [supportedModels, setSupportedModels] = useState(() => {
    const saved = localStorage.getItem('supported_gemini_models');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (open) {
      form.setFieldsValue(settings);
    }
  }, [open, settings, form]);

  const checkSupportedModels = async () => {
    const key = form.getFieldValue('geminiKey');
    if (!key) {
      message.warning('Vui lòng nhập Gemini API Key trước khi kiểm tra.');
      return;
    }
    setCheckingModels(true);
    try {
      const result = await window.electron.listGeminiModels(key);
      if (result.ok && result.models) {
        const modelNames = result.models.map((m) => m.name.replace('models/', ''));
        setSupportedModels(modelNames);
        localStorage.setItem('supported_gemini_models', JSON.stringify(modelNames));
        message.success('Kiểm tra Key thành công! Đã tải danh sách mô hình.');
      } else {
        throw new Error(result.error || 'Không thể lấy danh sách mô hình. Kiểm tra lại API Key.');
      }
    } catch (err) {
      message.error(`Lỗi kiểm tra Key: ${err.message}`);
    } finally {
      setCheckingModels(false);
    }
  };

  const handleOk = () => {
    form.validateFields().then((values) => {
      onSave(values);
      onCancel();
    });
  };

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined /> Cài đặt giọng nói AI
        </Space>
      }
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Lưu cấu hình"
      cancelText="Đóng"
      width={600}
      centered
      className="settings-modal-custom"
    >
      <Form form={form} layout="vertical" initialValues={settings} style={{ marginTop: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(59, 130, 246, 0.05)',
            padding: '12px 20px',
            borderRadius: '1rem',
            marginBottom: '24px',
          }}
        >
          <Text strong style={{ color: '#1e40af' }}>
            Kích hoạt chế độ AI cao cấp
          </Text>
          <Form.Item name="useAI" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        </div>

        <Divider orientation="left">
          <Space>
            <KeyOutlined /> Cấu hình FPT.AI
          </Space>
        </Divider>

        <Form.Item
          label="FPT.AI API Key"
          name="fptKey"
          extra={
            <span style={{ fontSize: '11px', color: '#8c8c8c' }}>
              Để trống hoặc nhập 'SERVER_KEY' để sử dụng key cài sẵn trên Server
            </span>
          }
        >
          <Input.Password placeholder="Dán API Key từ FPT.AI vào đây..." />
        </Form.Item>
        <Alert
          message={
            <div style={{ fontSize: '12px' }}>
              <Text strong>Cách lấy Key FPT.AI:</Text>
              <br />
              1. Truy cập{' '}
              <Link href="https://console.fpt.ai/" target="_blank">
                console.fpt.ai <LinkOutlined />
              </Link>
              .<br />
              2. Chọn dự án và tìm mục <Text code>API Key</Text> để copy mã.
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Divider orientation="left">
          <Space>
            <KeyOutlined /> Cấu hình OpenAI / Groq (Tốc độ cao)
          </Space>
        </Divider>

        <Form.Item
          label="OpenAI / Groq API Key"
          name="openaiKey"
          extra={
            <span style={{ fontSize: '11px', color: '#8c8c8c' }}>
              Để trống hoặc nhập 'SERVER_KEY' để sử dụng key cài sẵn trên Server
            </span>
          }
        >
          <Input.Password placeholder="Nhập sk-... hoặc gsk_..." />
        </Form.Item>
        <Alert
          message={
            <div style={{ fontSize: '12px' }}>
              <Text strong>Cách lấy Key:</Text>
              <br />•{' '}
              <Text strong style={{ color: '#dc2626' }}>
                Để dùng Groq (Nhẹ, Miễn phí & Cực nhanh):
              </Text>
              <br />
              1. Truy cập{' '}
              <Link href="https://console.groq.com/keys" target="_blank">
                Groq Console <LinkOutlined />
              </Link>
              .<br />
              2. Nhấn <Text code>Create API Key</Text> và dán mã bắt đầu bằng{' '}
              <Text code>gsk_...</Text> vào ô trên.
              <br />
              <div style={{ marginTop: '8px' }}>
                • <Text strong>Để dùng OpenAI (Trả phí):</Text>
                <br />
                1. Truy cập{' '}
                <Link href="https://platform.openai.com/api-keys" target="_blank">
                  OpenAI API Keys <LinkOutlined />
                </Link>
                .<br />
                2. Tạo key và dán mã bắt đầu bằng <Text code>sk-...</Text>.
              </div>
            </div>
          }
          type="success"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Divider orientation="left">
          <Space>
            <KeyOutlined /> Cấu hình Google Cloud Premium
          </Space>
        </Divider>

        <Form.Item
          label="Google Cloud API Key"
          name="googleKey"
          extra={
            <span style={{ fontSize: '11px', color: '#8c8c8c' }}>
              Để trống hoặc nhập 'SERVER_KEY' để sử dụng key cài sẵn trên Server
            </span>
          }
        >
          <Input.Password placeholder="Nhập API Key Google Cloud..." />
        </Form.Item>
        <Alert
          message={
            <div style={{ fontSize: '12px' }}>
              <Text strong>Cách lấy Key Google Cloud:</Text>
              <br />
              1. Truy cập{' '}
              <Link href="https://console.cloud.google.com/apis/credentials" target="_blank">
                Google Cloud Console <LinkOutlined />
              </Link>
              .<br />
              2. Tạo <Text code>API Key</Text> và Enable <Text code>Cloud Text-to-Speech API</Text>.
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Divider orientation="left">
          <Space>
            <KeyOutlined /> Cấu hình Google Gemini (Miễn phí)
          </Space>
        </Divider>

        <Form.Item
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <span>Gemini API Key</span>
              <Button 
                type="link" 
                size="small" 
                loading={checkingModels} 
                onClick={checkSupportedModels}
                style={{ padding: 0, height: 'auto', fontSize: '11px', color: '#0d9488', fontWeight: 600 }}
              >
                Kiểm tra Key & Model
              </Button>
            </div>
          }
          name="geminiKey"
          extra={
            <span style={{ fontSize: '11px', color: '#8c8c8c' }}>
              Để trống hoặc nhập 'SERVER_KEY' để sử dụng key cài sẵn trên Server
            </span>
          }
        >
          <Input.Password placeholder="Nhập Gemini API Key..." />
        </Form.Item>
        {supportedModels && (
          <div style={{ marginTop: '-12px', marginBottom: '16px', maxHeight: '120px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', background: '#f8fafc' }}>
            <div style={{ fontWeight: '700', fontSize: '11px', marginBottom: '6px', color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Mô hình được hỗ trợ bởi Key của bạn:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {supportedModels.map((m) => (
                <Tag key={m} style={{ margin: 0, fontSize: '11px', borderRadius: '4px', background: 'rgba(13, 148, 136, 0.08)', border: '1px solid rgba(13, 148, 136, 0.2)', color: '#0d9488' }}>
                  {m}
                </Tag>
              ))}
            </div>
          </div>
        )}
        <Alert
          message={
            <div style={{ fontSize: '12px' }}>
              <Text strong>Cách lấy Key Gemini (Free):</Text>
              <br />
              1. Truy cập{' '}
              <Link href="https://aistudio.google.com/app/apikey" target="_blank">
                Google AI Studio <LinkOutlined />
              </Link>
              .<br />
              2. Tạo <Text code>API Key</Text> và sử dụng miễn phí (giới hạn 15 req/phút).
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Divider orientation="left">
          <Space>
            <KeyOutlined /> Cấu hình Replicate (Tạo chuyển động video)
          </Space>
        </Divider>

        <Form.Item
          label="Replicate API Token"
          name="replicateKey"
          extra={
            <span style={{ fontSize: '11px', color: '#8c8c8c' }}>
              Dùng cho bước tạo video chuyển động (bằng Luma Dream Machine)
            </span>
          }
        >
          <Input.Password placeholder="Dán Replicate API Token bắt đầu bằng r8_..." />
        </Form.Item>
        <Alert
          message={
            <div style={{ fontSize: '12px' }}>
              <Text strong>Cách lấy Replicate Token:</Text>
              <br />
              1. Truy cập{' '}
              <Link href="https://replicate.com/settings/tokens" target="_blank">
                Replicate Tokens <LinkOutlined />
              </Link>
              .<br />
              2. Đăng ký tài khoản và tạo một <Text code>API Token</Text> mới.
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <div
          style={{
            background: 'rgba(250, 173, 20, 0.05)',
            padding: '12px',
            borderRadius: '0.75rem',
          }}
        >
          <Space align="start">
            <InfoCircleOutlined style={{ color: '#faad14', marginTop: '4px' }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Lưu ý: Các giọng nói AI cao cấp có thể phát sinh chi phí hoặc giới hạn ký tự tùy theo
              gói cước tài khoản của bạn.
            </Text>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default SettingsModal;
