import axiosInstance from 'src/constants/configAxios';
import helpers from 'src/helpers';

const apiService = {
  get: async (url, config = {}) => {
    try {
      const response = await axiosInstance.get(url, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  post: async (url, data, showMessageSuccess = false, messageSuccess = '', config = {}) => {
    try {
      const response = await axiosInstance.post(url, data, config);
      if (showMessageSuccess) {
        helpers.success(messageSuccess || 'Thao tác thành công');
      }
      return response.data;
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || 'Thao tác thất bại';
      helpers.error(errMsg);
      throw error;
    }
  },

  put: async (url, data, config = {}) => {
    try {
      const response = await axiosInstance.put(url, data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  delete: async (url, config = {}) => {
    try {
      const response = await axiosInstance.delete(url, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default apiService;
