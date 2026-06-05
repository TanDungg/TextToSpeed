// src/_hook/useAuth.js
import { useState, useEffect } from 'react';
import { AuthService } from '../_service/auth.service';

export const useAuth = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authRequired, setAuthRequired] = useState(true);
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem('token') || localStorage.getItem('access_token') || ''
  );
  const [authLoading, setAuthLoading] = useState(true);
  const [emailOrUserName, setEmailOrUserName] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const verifyInitialToken = async () => {
      const savedToken =
        localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      const isElectron = window.electron && !window.electron.isWebMock;

      if (isElectron) {
        if (!savedToken) {
          setAuthRequired(true);
          setIsAuthorized(false);
          setAuthLoading(false);
          return;
        }

        try {
          const data = await AuthService.verifyToken(savedToken);
          setIsAuthorized(true);
          setAuthRequired(false);
          setAccessToken(savedToken);
        } catch (err) {
          console.error('Lỗi kết nối API C# Auth từ Electron:', err);
          setIsAuthorized(false);
          setAuthRequired(true);
          if (err.message === 'Xác thực token thất bại.') {
            // Token hết hạn hoặc không hợp lệ, xóa token cũ và không báo lỗi kết nối máy chủ
            localStorage.removeItem('token');
            localStorage.removeItem('access_token');
            setAuthError('');
          } else {
            setAuthError('Không thể kết nối đến máy chủ xác thực tài khoản.');
          }
        } finally {
          setAuthLoading(false);
        }
        return;
      }

      // Luồng Web (Hugging Face)
      try {
        const data = await AuthService.verifyToken(savedToken);
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
      const data = await AuthService.login(emailOrUserName, password);

      const tokenVal = isElectron
        ? data.token || data.accessToken || (typeof data === 'string' ? data : '')
        : data.data?.token ||
          data.data?.accessToken ||
          (typeof data.data === 'string' ? data.data : '');

      if (tokenVal) {
        localStorage.setItem('token', tokenVal);
        localStorage.setItem('access_token', tokenVal);
        setAccessToken(tokenVal);
        setIsAuthorized(true);
        setAuthRequired(false);
      } else {
        setAuthError('Máy chủ phản hồi đăng nhập thành công nhưng không chứa mã token.');
      }
    } catch (err) {
      setAuthError(err.message || 'Không thể kết nối đến máy chủ đăng nhập.');
    } finally {
      setAuthLoading(false);
    }
  };

  return {
    isAuthorized,
    authRequired,
    accessToken,
    authLoading,
    emailOrUserName,
    setEmailOrUserName,
    password,
    setPassword,
    authError,
    setAuthError,
    handleLoginSubmit,
  };
};

export default useAuth;
