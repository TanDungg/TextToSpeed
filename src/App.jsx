import { useState, useEffect } from 'react';
import { Tabs, Button } from 'antd';
import TextToSpeed from './routes/TextToSpeed/TextToSpeed';
import AutoClick from './routes/AutoClick/AutoClick';
import AIVideoCreator from './routes/AIVideoCreator/AIVideoCreator';
import SettingsModal from './components/Setting/SettingsModal';
import { SoundOutlined, SettingOutlined, ThunderboltOutlined, VideoCameraOutlined } from '@ant-design/icons';

const App = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('tts_settings');
    if (saved) return JSON.parse(saved);
    return {
      useAI: true,
      openaiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
      fptKey: '',
      googleKey: '',
      geminiKey: '',
    };
  });

  useEffect(() => {
    localStorage.setItem('tts_settings', JSON.stringify(settings));
  }, [settings]);

  const items = [
    {
      key: '1',
      label: (
        <span>
          <SoundOutlined /> Chuyển văn bản
        </span>
      ),
      children: <TextToSpeed settings={settings} />,
    },
    {
      key: '2',
      label: (
        <span>
          <ThunderboltOutlined /> Auto Click
        </span>
      ),
      children: <AutoClick />,
    },
    {
      key: '3',
      label: (
        <span>
          <VideoCameraOutlined /> Video AI
        </span>
      ),
      children: <AIVideoCreator settings={settings} />,
    },
  ];

  return (
    <div className="app-main-layout">
      <div className="app-bg-accent"></div>
      <div className="app-content-wrapper">
        <div className="app-header-actions">
          <Button
            icon={<SettingOutlined />}
            shape="circle"
            size="large"
            className="settings-trigger"
            onClick={() => setShowSettings(true)}
          />
        </div>
        <Tabs
          defaultActiveKey="1"
          items={items}
          centered
          size="large"
          className="main-navigation-tabs"
        />
      </div>

      <SettingsModal
        open={showSettings}
        onCancel={() => setShowSettings(false)}
        settings={settings}
        onSave={(vals) => setSettings(vals)}
      />
    </div>
  );
};

export default App;
