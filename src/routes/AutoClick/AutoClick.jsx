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
    <div className="tool-container autoclick-container">
      <Card variant="borderless" className="tool-card">
        <header className="tool-header">
          <h1 className="tool-gradient-title">Auto Clicker Pro</h1>
          <div className="tool-status-bar">
            <Sparkles size={18} style={{ color: '#f59e0b' }} />
            <span>Mô phỏng click chuột tự động</span>
            <Divider type="vertical" />
            <Tag color="blue" bordered={false} style={{ borderRadius: '6px', fontWeight: 600 }}>
              v1.0.2
            </Tag>
          </div>
        </header>

        <div className="autoclick-content">

            <Row gutter={[32, 32]}>
              <Col xs={24} md={12}>
                <div className="tts-voice-box">
                  <div className="voice-label">
                    <Clock size={18} /> Khoảng cách (ms)
                  </div>
                  <InputNumber
                    min={10}
                    max={100000}
                    value={config.interval}
                    onChange={(v) => setConfig({ ...config, interval: v })}
                    style={{ width: '100%' }}
                    className="custom-input-number"
                    size="large"
                    disabled={isActive}
                  />
                  <Text type="secondary" style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}>
                    Tối thiểu 10ms (100 lần/giây)
                  </Text>
                </div>

                <div className="tts-voice-box" style={{ marginTop: '24px' }}>
                  <div className="voice-label">
                    <MousePointer2 size={18} /> Nút chuột
                  </div>
                  <Select
                    value={config.button}
                    onChange={(v) => setConfig({ ...config, button: v })}
                    style={{ width: '100%' }}
                    className="custom-select"
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
                <div className="tts-voice-box">
                  <div className="voice-label">
                    <ThunderboltOutlined /> Kiểu click
                  </div>
                  <Select
                    value={config.type}
                    onChange={(v) => setConfig({ ...config, type: v })}
                    style={{ width: '100%' }}
                    className="custom-select"
                    size="large"
                    disabled={isActive}
                    options={[
                      { value: 'single', label: 'Click đơn' },
                      { value: 'double', label: 'Click đúp' },
                    ]}
                  />
                </div>

                <div className="tts-voice-box" style={{ marginTop: '24px' }}>
                  <div className="voice-label">
                    <Settings2 size={18} /> Phím tắt (Hotkeys)
                  </div>
                  <div className="hotkey-display">
                    <Text>Bắt đầu / Dừng</Text>
                    <Tag color="blue" bordered={false} className="hotkey-tag">
                      {config.hotkey}
                    </Tag>
                  </div>
                </div>
              </Col>
            </Row>

            <Divider style={{ margin: '32px 0' }} />

            <div className="action-footer">
              <Button
                type="primary"
                size="large"
                danger={isActive}
                icon={isActive ? <StopOutlined style={{ fontSize: '20px' }} /> : <PlayCircleOutlined style={{ fontSize: '20px' }} />}
                onClick={toggleAutoClick}
                className={`autoclick-btn-main ${isActive ? 'active' : ''}`}
              >
                {isActive ? 'DỪNG AUTO CLICK' : 'BẮT ĐẦU AUTO CLICK'}
              </Button>

              <div className="status-alert-box">
                <Alert
                  message={
                    isActive
                      ? 'Đang chạy... Di chuyển chuột đến vị trí cần click.'
                      : `Nhấn phím ${config.hotkey} để Bắt đầu/Dừng bất cứ lúc nào.`
                  }
                  type={isActive ? 'warning' : 'info'}
                  showIcon
                  className="custom-alert"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>
  );
};

export default AutoClick;
