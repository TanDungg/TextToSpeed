import apiService from 'src/util/apiService';
const URL_SERVICE = `/api/Friends`;

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

export const FriendsService = {
  getAllFriends: async (params = {}) => {
    try {
      const cleanedParams = cleanParams(params);
      const response = await apiService.get(URL_SERVICE, {
        params: { ...cleanedParams },
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  getAllReceivedFriends: async (params = {}) => {
    try {
      const cleanedParams = cleanParams(params);
      const response = await apiService.get(`${URL_SERVICE}/requests-received`, {
        params: { ...cleanedParams },
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  getAllSentFriends: async (params = {}) => {
    try {
      const cleanedParams = cleanParams(params);
      const response = await apiService.get(`${URL_SERVICE}/requests-sent`, {
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
      const response = await apiService.post(`${URL_SERVICE}`, data, false, '', {
        params: { ...cleanedParams },
      });

      return response;
    } catch (error) {
      throw error;
    }
  },

  put: async (id, data) => {
    try {
      const response = await apiService.put(`${URL_SERVICE}/${id}`, data);

      return response;
    } catch (error) {
      throw error;
    }
  },

  // getById: async (id) => {
  //   try {
  //     return await apiService.get(`${URL_SERVICE}/${id}`);
  //   } catch (error) {
  //     throw error;
  //   }
  // },

  // put: async (id, data) => {
  //   const donViId = getLocalStorage('menu')?.donVi_Id || null;
  //   try {
  //     const response = await apiService.put(`${URL_SERVICE}/${id}`, {
  //       ...data,
  //       donVi_Id: donViId,
  //     });

  //     return response;
  //   } catch (error) {
  //     throw error;
  //   }
  // },

  // delete: async (id) => {
  //   return apiService.delete(`${URL_SERVICE}/${id}`);
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
  //     return await apiService.get(`${URL_SERVICE}/thong-tin-man-hinh`, {
  //       params: params,
  //     });
  //   } catch (error) {
  //     throw error;
  //   }
  // },
};
