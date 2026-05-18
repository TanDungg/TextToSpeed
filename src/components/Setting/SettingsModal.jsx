import { Modal, Form, Input, Switch, Typography, Divider, Alert, Space } from 'antd';
import { KeyOutlined, InfoCircleOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';
import './SettingsModalStyles.scss';

const { Text, Link } = Typography;

const SettingsModal = ({ open, onCancel, settings, onSave }) => {
  const [form] = Form.useForm();

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

        <Form.Item label="FPT.AI API Key" name="fptKey">
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

        <Form.Item label="OpenAI / Groq API Key" name="openaiKey">
          <Input.Password placeholder="Nhập sk-... hoặc gsk_..." />
        </Form.Item>
        <Alert
          message={
            <div style={{ fontSize: '12px' }}>
              <Text strong>Cách lấy Key:</Text>
              <br />
              • <Text strong style={{ color: '#dc2626' }}>Để dùng Groq (Nhẹ, Miễn phí & Cực nhanh):</Text>
              <br />
              1. Truy cập{' '}
              <Link href="https://console.groq.com/keys" target="_blank">
                Groq Console <LinkOutlined />
              </Link>
              .<br />
              2. Nhấn <Text code>Create API Key</Text> và dán mã bắt đầu bằng <Text code>gsk_...</Text> vào ô trên.
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

        <Form.Item label="Google Cloud API Key" name="googleKey">
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

        <Form.Item label="Gemini API Key" name="geminiKey">
          <Input.Password placeholder="Nhập Gemini API Key..." />
        </Form.Item>
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
