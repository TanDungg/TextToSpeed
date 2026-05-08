// src/helpers/index.js
import { notification } from 'antd';

const notify = (type, message, description) => {
  notification[type]({
    message: message,
    description: description,
    placement: 'topRight',
    duration: 4,
  });
};

const helpers = {
  success: (message, description) => notify('success', message || 'Thành công', description),
  error: (message, description) => notify('error', message || 'Lỗi', description),
  warning: (message, description) => notify('warning', message || 'Cảnh báo', description),
  info: (message, description) => notify('info', message || 'Thông báo', description),
};

export default helpers;
