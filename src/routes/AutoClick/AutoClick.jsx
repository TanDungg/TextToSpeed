import { useState, useEffect } from 'react';
import { Card, Button, InputNumber, Select, Space, Typography, Tag, Divider, Row, Col, message, Alert } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, StopOutlined, ThunderboltOutlined, SettingOutlined } from '@ant-design/icons';
import { Sparkles, MousePointer2, Clock, Settings2, Power } from 'lucide-react';

const { Title, Text } = Typography;

const AutoClick = () => {
  const [config, setConfig] = useState({
    interval: 100, // ms
    button: 'left',
    type: 'single',
    repeat: 0, // 0 means infinite
    hotkey: 'F6'
  });
  const [isActive, setIsActive] = useState(false);

  const toggleAutoClick = () => {
    if (!window.electron) {
        message.error("Ứng dụng cần được chạy trong Electron để sử dụng tính năng này.");
        return;
    }

    const nextState = !isActive;
    setIsActive(nextState);

    if (nextState) {
      window.electron.send('start-autoclick', config);
      message.success(`Đã bắt đầu Auto Click (${config.hotkey} để dừng)`);
    } else {
      window.electron.send('stop-autoclick');
      message.info("Đã dừng Auto Click");
    }
  };

  useEffect(() => {
    if (window.electron) {
        const removeListener = window.electron.on('autoclick-status-changed', (status) => {
            setIsActive(status);
        });
        return () => removeListener();
    }
  }, []);

  return (
    <div className="autoclick-container" style={{ paddingBottom: '20px' }}>
      <Card bordered={false} className="tts-card">
        <div className="main-header" style={{ marginBottom: 24 }}>
          <div className="main-title-section">
            <Title level={2} className="tts-gradient-title">Auto Clicker Pro</Title>
            <div className="main-status" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <Sparkles size={16} className="text-amber-500" />
              <Text type="secondary">Mô phỏng click chuột tự động</Text>
            </div>
          </div>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <div className="config-item" style={{ marginBottom: '20px' }}>
              <Text strong className="block mb-2">
                <Space><Clock size={16} /> Khoảng cách (ms)</Space>
              </Text>
              <InputNumber 
                min={10} 
                max={100000} 
                value={config.interval} 
                onChange={(v) => setConfig({...config, interval: v})} 
                style={{ width: '100%', borderRadius: '8px' }} 
                size="large"
                disabled={isActive}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>Tối thiểu 10ms (100 lần/giây)</Text>
            </div>

            <div className="config-item" style={{ marginBottom: '20px' }}>
              <Text strong className="block mb-2">
                <Space><MousePointer2 size={16} /> Nút chuột</Space>
              </Text>
              <Select 
                value={config.button} 
                onChange={(v) => setConfig({...config, button: v})} 
                style={{ width: '100%' }} 
                size="large"
                disabled={isActive}
                options={[
                  { value: 'left', label: 'Chuột trái' },
                  { value: 'right', label: 'Chuột phải' },
                  { value: 'middle', label: 'Chuột giữa' },
                ]}
              />
            </div>
          </Col>

          <Col xs={24} md={12}>
            <div className="config-item" style={{ marginBottom: '20px' }}>
              <Text strong className="block mb-2">
                <Space><ThunderboltOutlined /> Kiểu click</Space>
              </Text>
              <Select 
                value={config.type} 
                onChange={(v) => setConfig({...config, type: v})} 
                style={{ width: '100%' }} 
                size="large"
                disabled={isActive}
                options={[
                  { value: 'single', label: 'Click đơn' },
                  { value: 'double', label: 'Click đúp' },
                ]}
              />
            </div>

            <div className="config-item" style={{ marginBottom: '20px' }}>
              <Text strong className="block mb-2">
                <Space><Settings2 size={16} /> Phím tắt (Hotkeys)</Space>
              </Text>
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text>Bắt đầu / Dừng</Text>
                <Tag color="blue" style={{ fontSize: '14px', padding: '2px 8px' }}>{config.hotkey}</Tag>
              </div>
            </div>
          </Col>
        </Row>

        <Divider />

        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Button 
            type="primary" 
            size="large" 
            danger={isActive}
            icon={isActive ? <StopOutlined /> : <PlayCircleOutlined />}
            onClick={toggleAutoClick}
            style={{ 
                height: '60px', 
                width: '250px', 
                borderRadius: '30px', 
                fontSize: '18px', 
                fontWeight: '700',
                boxShadow: isActive ? '0 10px 15px -3px rgba(239, 68, 68, 0.4)' : '0 10px 15px -3px rgba(59, 130, 246, 0.4)'
            }}
          >
            {isActive ? 'DỪNG AUTO CLICK' : 'BẮT ĐẦU AUTO CLICK'}
          </Button>
          
          <div style={{ marginTop: '20px' }}>
            <Alert 
              message={isActive ? "Đang chạy... Hãy di chuyển chuột đến vị trí cần click." : `Nhấn phím ${config.hotkey} để Bắt đầu/Dừng bất cứ lúc nào.`} 
              type={isActive ? "warning" : "info"} 
              showIcon 
              style={{ borderRadius: '12px' }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AutoClick;
