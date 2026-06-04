import { useState, useEffect } from 'react';
import { Button } from 'antd';
import { BASE_URL_API } from './constants/config';
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
  UserOutlined,
  LockOutlined,
} from '@ant-design/icons';

// Interceptor cho fetch toàn cục để tự động đính kèm mã truy cập (Access Token) vào Header của mọi request gửi lên Server
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (url, options = {}) => {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      if (token) {
        options.headers = options.headers || {};
        if (options.headers instanceof Headers) {
          options.headers.set('Authorization', `Bearer ${token}`);
        } else if (Array.isArray(options.headers)) {
          const hasAuth = options.headers.some(([k]) => k.toLowerCase() === 'authorization');
          if (!hasAuth) {
            options.headers.push(['Authorization', `Bearer ${token}`]);
          }
        } else {
          if (!options.headers['Authorization'] && !options.headers['authorization']) {
            options.headers['Authorization'] = `Bearer ${token}`;
          }
        }
      }
    }
    return originalFetch(url, options);
  };
}

const App = () => {
  const [activeTab, setActiveTab] = useState('1');
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Các trạng thái bảo mật của hệ thống
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem('token') || localStorage.getItem('access_token') || ''
  );
  const [authLoading, setAuthLoading] = useState(true);
  const [emailOrUserName, setEmailOrUserName] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const verifyInitialToken = async () => {
      const savedToken = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      const isElectron = window.electron && !window.electron.isWebMock;

      if (isElectron) {
        if (!savedToken) {
          setAuthRequired(true);
          setIsAuthorized(false);
          setAuthLoading(false);
          return;
        }

        try {
          const response = await fetch(`${BASE_URL_API}/api/auth/me`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${savedToken}`
            }
          });
          if (response.ok) {
            setIsAuthorized(true);
            setAuthRequired(false);
            setAccessToken(savedToken);
          } else {
            setIsAuthorized(false);
            setAuthRequired(true);
          }
        } catch (err) {
          console.error('Lỗi kết nối API C# Auth từ Electron:', err);
          setIsAuthorized(false);
          setAuthRequired(true);
          setAuthError('Không thể kết nối đến máy chủ xác thực tài khoản.');
        } finally {
          setAuthLoading(false);
        }
        return;
      }

      // Luồng Web (Hugging Face)
      try {
        const response = await fetch('/api/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: savedToken }),
        });
        const data = await response.json();

        if (data.required) {
          setAuthRequired(true);
          if (data.ok) {
            setIsAuthorized(true);
            setAccessToken(savedToken);
          } else {
            setIsAuthorized(false);
          }
        } else {
          setAuthRequired(false);
          setIsAuthorized(true);
        }
      } catch (err) {
        console.error('Lỗi xác thực mã truy cập trên Web:', err);
        // Nếu không chạy được server API (chạy offline local dev), cho phép truy cập tự do
        setIsAuthorized(true);
      } finally {
        setAuthLoading(false);
      }
    };
    verifyInitialToken();
  }, []);

  const handleLoginSubmit = async () => {
    if (!emailOrUserName.trim()) {
      setAuthError('Vui lòng nhập tên đăng nhập hoặc email.');
      return;
    }
    if (!password.trim()) {
      setAuthError('Vui lòng nhập mật khẩu.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    const isElectron = window.electron && !window.electron.isWebMock;

    try {
      let response;
      if (isElectron) {
        response = await fetch(`${BASE_URL_API}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailOrUserName: emailOrUserName.trim(),
            password: password.trim(),
          }),
        });
      } else {
        response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailOrUserName: emailOrUserName.trim(),
            password: password.trim(),
          }),
        });
      }

      const data = await response.json();
      
      if (response.ok) {
        const tokenVal = isElectron 
          ? (data.token || data.accessToken || (typeof data === 'string' ? data : ''))
          : (data.data?.token || data.data?.accessToken || (typeof data.data === 'string' ? data.data : ''));
          
        if (tokenVal) {
          localStorage.setItem('token', tokenVal);
          localStorage.setItem('access_token', tokenVal);
          setAccessToken(tokenVal);
          setIsAuthorized(true);
          setAuthRequired(false);
        } else {
          setAuthError('Máy chủ phản hồi đăng nhập thành công nhưng không chứa mã token.');
        }
      } else {
        const errMsg = typeof data === 'string' ? data : (data.error || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
        setAuthError(errMsg);
      }
    } catch (err) {
      setAuthError(err.message || 'Không thể kết nối đến máy chủ đăng nhập.');
    } finally {
      setAuthLoading(false);
    }
  };
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

  if (authLoading) {
    return (
      <div className="system-loading-container">
        <div className="system-loading-spinner-box">
          <div className="system-loading-spinner"></div>
          <div className="system-loading-text">Đang tải hệ thống...</div>
        </div>
      </div>
    );
  }

  if (authRequired && !isAuthorized) {
    return (
      <div className="lock-screen-container">
        <div className="lock-bg-blob lock-bg-blob-1"></div>
        <div className="lock-bg-blob lock-bg-blob-2"></div>
        <div className="lock-bg-blob lock-bg-blob-3"></div>
        <div className="lock-card">
          <div className="lock-icon-box">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2>Đăng Nhập Hệ Thống</h2>
          <p>Vui lòng đăng nhập tài khoản của bạn để sử dụng bộ công cụ AI.</p>

          <div className="login-input-wrapper">
            <span className="login-input-icon">
              <UserOutlined />
            </span>
            <input
              type="text"
              placeholder="Tên đăng nhập hoặc Email..."
              value={emailOrUserName}
              onChange={(e) => setEmailOrUserName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoginSubmit()}
              className="login-input"
            />
          </div>

          <div className="login-input-wrapper">
            <span className="login-input-icon">
              <LockOutlined />
            </span>
            <input
              type="password"
              placeholder="Mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoginSubmit()}
              className="login-input"
            />
          </div>

          {authError && (
            <div className="login-error-alert">
              {authError}
            </div>
          )}

          <Button
            type="primary"
            size="large"
            onClick={handleLoginSubmit}
            loading={authLoading}
            className="login-btn"
          >
            ĐĂNG NHẬP
          </Button>
        </div>
      </div>
    );
  }

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
      {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}></div>}

      {/* Left Navigation Sidebar */}
      <aside
        className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${drawerOpen ? 'drawer-open' : ''}`}
      >
        <div
          className="sidebar-logo"
          onClick={() => {
            setCollapsed(!collapsed);
            setDrawerOpen(false); // Close drawer if clicked on mobile
          }}
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
