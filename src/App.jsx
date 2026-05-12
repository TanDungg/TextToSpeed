import { useState, useEffect } from 'react';
import { Tabs, Button } from 'antd';
import TextToSpeed from './routes/TextToSpeed/TextToSpeed';
import AutoClick from './routes/AutoClick/AutoClick';
import SettingsModal from './components/Setting/SettingsModal';
import { SoundOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';

const App = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('tts_settings');
    if (saved) return JSON.parse(saved);
    return {
      useAI: true,
      openaiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
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
  ];

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '16px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
        <div style={{ position: 'absolute', right: 0, top: 8, zIndex: 10 }}>
          <Button
            icon={<SettingOutlined />}
            shape="circle"
            size="large"
            onClick={() => setShowSettings(true)}
          />
        </div>
        <Tabs defaultActiveKey="1" items={items} centered size="large" />
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
