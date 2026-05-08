import { Modal, Form, Input, Select, Switch, Typography, Space, Divider, Alert } from 'antd';
import { KeyOutlined, GlobalOutlined, InfoCircleOutlined } from '@ant-design/icons';

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
      title="Cài đặt giọng nói AI"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Lưu cấu hình"
      cancelText="Hủy"
      width={500}
      centered
      className="rounded-3xl overflow-hidden"
    >
      <Form 
        form={form} 
        layout="vertical" 
        initialValues={settings} 
        className="mt-4"
        onValuesChange={() => {
          // Re-validate or update state if needed
        }}
      >
        <Form.Item
          label="Chế độ giọng nói"
          name="useExternal"
          valuePropName="checked"
        >
          <Switch 
            checkedChildren="AI (Cao cấp)" 
            unCheckedChildren="Hệ thống (Miễn phí)" 
          />
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.useExternal !== curr.useExternal}>
          {({ getFieldValue }) => 
            getFieldValue('useExternal') && (
              <>
                <Divider className="my-4" />
                
                <Form.Item
                  label="Nhà cung cấp AI"
                  name="provider"
                  rules={[{ required: true, message: 'Vui lòng chọn nhà cung cấp' }]}
                >
                  <Select
                    options={[
                      { value: 'openai', label: 'OpenAI (Trả phí - Cực hay)' },
                      { value: 'fpt', label: 'FPT.AI (Có gói Free 100k - Tiếng Việt chuẩn)' },
                      { value: 'google', label: 'Google Translate (Miễn phí)' },
                      { value: 'edge', label: 'Microsoft Edge (Miễn phí - Rất hay)' },
                    ]}
                  />
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.provider !== curr.provider}>
                  {({ getFieldValue }) => {
                    const provider = getFieldValue('provider');
                    if (provider === 'openai') {
                      return (
                        <>
                          <Form.Item
                            label="OpenAI API Key"
                            name="openaiKey"
                            rules={[{ required: true, message: 'Vui lòng nhập OpenAI API Key' }]}
                          >
                            <Input.Password prefix={<KeyOutlined />} placeholder="sk-..." />
                          </Form.Item>
                          <Alert
                            message={
                              <Text size="small">
                                Lấy Key tại: <Link href="https://platform.openai.com/api-keys" target="_blank">OpenAI Dashboard</Link>
                              </Text>
                            }
                            type="info"
                            showIcon
                          />
                        </>
                      );
                    }
                    if (provider === 'fpt') {
                      return (
                        <>
                          <Form.Item
                            label="FPT.AI API Key"
                            name="fptKey"
                            rules={[{ required: true, message: 'Vui lòng nhập FPT API Key' }]}
                          >
                            <Input.Password prefix={<KeyOutlined />} placeholder="Nhập Key FPT của bạn..." />
                          </Form.Item>
                          <Alert
                            message={
                              <Text size="small">
                                Lấy Key miễn phí tại: <Link href="https://console.fpt.ai/" target="_blank">FPT.AI Console</Link>
                              </Text>
                            }
                            type="info"
                            showIcon
                          />
                        </>
                      );
                    }
                    if (provider === 'google' || provider === 'edge') {
                      return (
                        <Alert
                          message="Nhà cung cấp này hoàn toàn miễn phí và không cần API Key."
                          type="success"
                          showIcon
                        />
                      );
                    }
                    return null;
                  }}
                </Form.Item>
              </>
            )
          }
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SettingsModal;
