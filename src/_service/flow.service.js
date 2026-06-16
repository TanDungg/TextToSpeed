import apiService from 'src/util/apiService';

// Thư viện mock database sử dụng localStorage để chạy dự phòng nếu Server API chưa bật hoặc bị lỗi
const localStorageFallback = {
  getProjects: () => {
    const list = localStorage.getItem('flow_projects');
    return list ? JSON.parse(list) : [];
  },
  saveProjects: (list) => {
    localStorage.setItem('flow_projects', JSON.stringify(list));
  },
  createProject: (name) => {
    const list = localStorageFallback.getProjects();
    const newProject = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      createdAt: new Date().toISOString(),
      assets: [],
    };
    list.unshift(newProject);
    localStorageFallback.saveProjects(list);
    return newProject;
  },
  getProject: (id) => {
    const list = localStorageFallback.getProjects();
    return list.find((p) => p.id === id) || null;
  },
  updateProject: (id, name) => {
    const list = localStorageFallback.getProjects();
    const idx = list.findIndex((p) => p.id === id);
    if (idx !== -1) {
      list[idx].name = name;
      list[idx].updatedAt = new Date().toISOString();
      localStorageFallback.saveProjects(list);
      return list[idx];
    }
    return null;
  },
  deleteProject: (id) => {
    let list = localStorageFallback.getProjects();
    list = list.filter((p) => p.id !== id);
    localStorageFallback.saveProjects(list);
    return true;
  },
  addAsset: (projectId, type, url, prompt, ratio) => {
    const list = localStorageFallback.getProjects();
    const idx = list.findIndex((p) => p.id === projectId);
    if (idx !== -1) {
      const asset = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        url,
        prompt,
        ratio,
        createdAt: new Date().toISOString(),
      };
      if (!list[idx].assets) list[idx].assets = [];
      list[idx].assets.unshift(asset);
      localStorageFallback.saveProjects(list);
      return asset;
    }
    return null;
  },
  deleteAsset: (projectId, assetId) => {
    const list = localStorageFallback.getProjects();
    const idx = list.findIndex((p) => p.id === projectId);
    if (idx !== -1 && list[idx].assets) {
      list[idx].assets = list[idx].assets.filter((a) => a.id !== assetId);
      localStorageFallback.saveProjects(list);
      return true;
    }
    return false;
  },
};

export const FlowService = {
  getProjects: async () => {
    try {
      return await apiService.get('/api/flow/projects');
    } catch (error) {
      console.warn(
        '[FlowService] API /api/flow/projects bị lỗi. Sử dụng localStorage dự phòng:',
        error.message
      );
      return localStorageFallback.getProjects();
    }
  },

  createProject: async (name) => {
    try {
      return await apiService.post('/api/flow/projects', { name });
    } catch (error) {
      console.warn(
        '[FlowService] API createProject bị lỗi. Sử dụng localStorage dự phòng:',
        error.message
      );
      return localStorageFallback.createProject(name);
    }
  },

  getProjectDetail: async (id) => {
    try {
      // Nếu ID là dạng Guid (chứa dấu gạch ngang chuẩn) thì gọi API, còn nếu là của localStorage (mock) thì lấy từ localStorage
      if (id.includes('-') && id.length > 20) {
        return await apiService.get(`/api/flow/projects/${id}`);
      }
      return localStorageFallback.get(id) || localStorageFallback.getProject(id);
    } catch (error) {
      console.warn(
        `[FlowService] API getProjectDetail(${id}) bị lỗi. Sử dụng localStorage dự phòng:`,
        error.message
      );
      return localStorageFallback.getProject(id);
    }
  },

  updateProject: async (id, name) => {
    try {
      if (id.includes('-') && id.length > 20) {
        return await apiService.put(`/api/flow/projects/${id}`, { name });
      }
      return localStorageFallback.updateProject(id, name);
    } catch (error) {
      console.warn(
        `[FlowService] API updateProject(${id}) bị lỗi. Sử dụng localStorage dự phòng:`,
        error.message
      );
      return localStorageFallback.updateProject(id, name);
    }
  },

  deleteProject: async (id) => {
    try {
      if (id.includes('-') && id.length > 20) {
        return await apiService.delete(`/api/flow/projects/${id}`);
      }
      return localStorageFallback.deleteProject(id);
    } catch (error) {
      console.warn(
        `[FlowService] API deleteProject(${id}) bị lỗi. Sử dụng localStorage dự phòng:`,
        error.message
      );
      return localStorageFallback.deleteProject(id);
    }
  },

  addAsset: async (projectId, type, url, prompt, ratio) => {
    try {
      if (projectId.includes('-') && projectId.length > 20) {
        return await apiService.post(`/api/flow/projects/${projectId}/assets`, {
          type,
          url,
          prompt,
          ratio,
        });
      }
      return localStorageFallback.addAsset(projectId, type, url, prompt, ratio);
    } catch (error) {
      console.warn(
        `[FlowService] API addAsset bị lỗi. Sử dụng localStorage dự phòng:`,
        error.message
      );
      return localStorageFallback.addAsset(projectId, type, url, prompt, ratio);
    }
  },

  deleteAsset: async (projectId, assetId) => {
    try {
      if (projectId.includes('-') && projectId.length > 20) {
        return await apiService.delete(`/api/flow/projects/${projectId}/assets/${assetId}`);
      }
      return localStorageFallback.deleteAsset(projectId, assetId);
    } catch (error) {
      console.warn(
        `[FlowService] API deleteAsset bị lỗi. Sử dụng localStorage dự phòng:`,
        error.message
      );
      return localStorageFallback.deleteAsset(projectId, assetId);
    }
  },
};
