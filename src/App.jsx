import { useState, useEffect } from 'react';
import { Button } from 'antd';
import TextToSpeed from './routes/TextToSpeed/TextToSpeed';
import AutoClick from './routes/AutoClick/AutoClick';
import VideoRemaker from './routes/VideoRemaker/VideoRemaker';
import MediaEnhancer from './routes/MediaEnhancer/MediaEnhancer';
import VideoSubExtractor from './routes/VideoSubExtractor/VideoSubExtractor';
import LofiHelper from './routes/LofiHelper/LofiHelper';
import SettingsModal from './components/Setting/SettingsModal';
import {
  SoundOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  PictureOutlined,
  FileTextOutlined,
  CustomerServiceOutlined,
  AppstoreOutlined,
  MenuOutlined,
} from '@ant-design/icons';

const App = () => {
  const [activeTab, setActiveTab] = useState('1');
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      icon: <SoundOutlined />,
      label: 'Chuyển văn bản',
      children: <TextToSpeed settings={settings} />,
    },
    {
      key: '2',
      icon: <ThunderboltOutlined />,
      label: 'Auto Click',
      children: <AutoClick />,
    },
    {
      key: '3',
      icon: <PlayCircleOutlined />,
      label: 'Video Remaker',
      children: <VideoRemaker settings={settings} />,
    },
    {
      key: '4',
      icon: <PictureOutlined />,
      label: 'Làm nét Ảnh/Video',
      children: <MediaEnhancer />,
    },
    {
      key: '5',
      icon: <FileTextOutlined />,
      label: 'Trích xuất Phụ đề',
      children: <VideoSubExtractor />,
    },
    {
      key: '6',
      icon: <CustomerServiceOutlined />,
      label: 'Hỗ trợ Lofi Remix',
      children: <LofiHelper settings={settings} />,
    },
  ];

  return (
    <div className="app-layout-container">
      <div className="app-bg-accent"></div>

      {/* Mobile Header Bar */}
      <header className="mobile-header">
        <button className="menu-toggle-btn" onClick={() => setDrawerOpen(true)} title="Mở menu">
          <MenuOutlined />
        </button>
        <div className="mobile-logo" onClick={() => setDrawerOpen(true)}>
          <AppstoreOutlined className="logo-icon" />
          <span className="logo-text">AI Tool Suite</span>
        </div>
      </header>

      {/* Drawer Backdrop overlay */}
      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}></div>
      )}

      {/* Left Navigation Sidebar */}
      <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
        <div
          className="sidebar-logo"
          onClick={() => {
            setCollapsed(!collapsed);
            setDrawerOpen(false); // Close drawer if clicked on mobile
          }}
          style={{ cursor: 'pointer' }}
          title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        >
          <AppstoreOutlined className="logo-icon" />
          <span className="logo-text">AI Tool Suite</span>
        </div>

        <nav className="sidebar-menu">
          {items.map((item) => (
            <button
              key={item.key}
              className={`menu-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.key);
                setDrawerOpen(false); // Close drawer when selecting an item
              }}
              title={item.label}
            >
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Button
            type="text"
            icon={<SettingOutlined />}
            className="settings-btn"
            onClick={() => {
              setShowSettings(true);
              setDrawerOpen(false); // Close drawer when clicking settings
            }}
            title="Cài đặt hệ thống"
          >
            Cài đặt hệ thống
          </Button>
        </div>
      </aside>

      {/* Right Main Content */}
      <main className="app-main-content">
        {items.find((item) => item.key === activeTab)?.children}
      </main>

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
