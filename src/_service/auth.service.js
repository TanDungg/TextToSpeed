// src/_service/auth.service.js
import { BASE_URL_API } from 'src/constants/config';

const isElectronEnv = () => window.electron && !window.electron.isWebMock;

export const AuthService = {
  verifyToken: async (token) => {
    const isElectron = isElectronEnv();
    if (isElectron) {
      const response = await fetch(`${BASE_URL_API}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Xác thực token thất bại.');
      }
      // Return expected structure matching App.jsx logic
      return { ok: true, required: true };
    } else {
      const response = await fetch('/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Lỗi hệ thống (${response.status}): Phản hồi từ máy chủ không hợp lệ.`);
      }
      if (!response.ok) {
        throw new Error(data.error || 'Xác thực token thất bại.');
      }
      return data;
    }
  },

  login: async (emailOrUserName, password) => {
    const isElectron = isElectronEnv();
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

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      const errMsg = typeof data === 'string' ? data : (data.error || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
      throw new Error(errMsg);
    }
    return data;
  }
};
export default AuthService;
