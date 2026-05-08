import apiService from 'src/util/apiService';
const URL_SERVICE_CONVERSATIONS = `/api/Conversations`;

const cleanParams = (params) => {
  if (!params || typeof params !== 'object') {
    return {};
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

export const ConversationsService = {
  getAllConversations: async (params = {}) => {
    try {
      const cleanedParams = cleanParams(params);
      const response = await apiService.get(URL_SERVICE_CONVERSATIONS, {
        params: { ...cleanedParams },
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  getAllReceivedConversations: async (params = {}) => {
    try {
      const cleanedParams = cleanParams(params);
      const response = await apiService.get(`${URL_SERVICE_CONVERSATIONS}/requests-received`, {
        params: { ...cleanedParams },
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  getAllSentConversations: async (params = {}) => {
    try {
      const cleanedParams = cleanParams(params);
      const response = await apiService.get(`${URL_SERVICE_CONVERSATIONS}/requests-sent`, {
        params: { ...cleanedParams },
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  post: async (data, params = {}) => {
    try {
      const cleanedParams = cleanParams(params);
      const response = await apiService.post(`${URL_SERVICE_CONVERSATIONS}`, data, false, '', {
        params: { ...cleanedParams },
      });

      return response;
    } catch (error) {
      throw error;
    }
  },

  put: async (id, data) => {
    try {
      const response = await apiService.put(`${URL_SERVICE_CONVERSATIONS}/${id}`, data);

      return response;
    } catch (error) {
      throw error;
    }
  },

  // getById: async (id) => {
  //   try {
  //     return await apiService.get(`${URL_SERVICE_CONVERSATIONS}/${id}`);
  //   } catch (error) {
  //     throw error;
  //   }
  // },

  // put: async (id, data) => {
  //   const donViId = getLocalStorage('menu')?.donVi_Id || null;
  //   try {
  //     const response = await apiService.put(`${URL_SERVICE_CONVERSATIONS}/${id}`, {
  //       ...data,
  //       donVi_Id: donViId,
  //     });

  //     return response;
  //   } catch (error) {
  //     throw error;
  //   }
  // },

  // delete: async (id) => {
  //   return apiService.delete(`${URL_SERVICE_CONVERSATIONS}/${id}`);
  // },

  // getListCongDoanTree: async (params = {}) => {
  //   try {
  //     const cleanedParams = cleanParams(params);
  //     const response = await apiService.get('/api/pmerp_dmc_CongDoan', {
  //       params: { ...cleanedParams },
  //     });
  //     return response;
  //   } catch (error) {
  //     throw error;
  //   }
  // },

  // getXemUser: async (params) => {
  //   try {
  //     return await apiService.get(`${URL_SERVICE_CONVERSATIONS}/thong-tin-man-hinh`, {
  //       params: params,
  //     });
  //   } catch (error) {
  //     throw error;
  //   }
  // },
};
