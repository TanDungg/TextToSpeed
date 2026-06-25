import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Input, 
  Modal, 
  Upload, 
  Select, 
  Dropdown, 
  Menu, 
  message, 
  Tooltip,
  Empty
} from 'antd';
import { 
  ArrowLeftOutlined, 
  SettingOutlined, 
  PictureOutlined, 
  PlayCircleOutlined,
  DeleteOutlined, 
  PlusOutlined, 
  SearchOutlined, 
  MenuUnfoldOutlined, 
  MenuFoldOutlined,
  LoadingOutlined,
  FolderOpenOutlined,
  VideoCameraOutlined,
  DownloadOutlined,
  EyeOutlined,
  CloseOutlined,
  GlobalOutlined,
  RobotOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { FlowService } from '../../_service/flow.service';
import './FlowStudio.scss';

const getMediaUrl = (filePath) => {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:') || filePath.startsWith('media://')) {
    return filePath;
  }
  return `media://${encodeURIComponent(filePath)}`;
};

const FlowStudio = ({ globalSettings }) => {
  // Authentication & API keys (from Settings modal)
  const geminiKey = globalSettings?.geminiKey || (localStorage.getItem('tts_settings') ? JSON.parse(localStorage.getItem('tts_settings')).geminiKey : '') || '';

  // App States
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null); // { id, name, assets: [] }
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // UI Layout States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('all'); // all, image, video, character, scene, upload
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null); // { type, url, prompt }
  const [renameProjectId, setRenameProjectId] = useState(null);
  const [renameProjectName, setRenameProjectName] = useState('');

  // Generation Inputs
  const [prompt, setPrompt] = useState('');
  const [genMode, setGenMode] = useState('image'); // image, video
  const [ratio, setRatio] = useState('16:9');
  const [quantity, setQuantity] = useState('1x');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-image');
  
  // Reference Images (up to 3 slots: Face, Pose, Style)
  const [referenceImages, setReferenceImages] = useState({
    face: null, // { file, base64 }
    pose: null,
    style: null
  });

  // Loading generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');

  // Load projects list on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Sync default model when generation mode changes
  useEffect(() => {
    if (genMode === 'image') {
      setSelectedModel('gemini-3.1-flash-image');
    } else {
      setSelectedModel('veo-3.0-generate-001');
    }
  }, [genMode]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const data = await FlowService.getProjects();
      setProjects(data || []);
    } catch (err) {
      message.error('Không thể tải danh sách dự án.');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleCreateProject = () => {
    let projName = `Dự án ngày ${new Date().getDate()} thg ${new Date().getMonth() + 1}`;
    Modal.confirm({
      title: 'Tạo dự án mới',
      content: (
        <Input 
          defaultValue={projName}
          onChange={(e) => { projName = e.target.value; }}
          placeholder="Nhập tên dự án..." 
          style={{ marginTop: '10px' }}
        />
      ),
      okText: 'Tạo',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const res = await FlowService.createProject(projName);
          if (res) {
            message.success('Đã tạo dự án mới.');
            fetchProjects();
            handleSelectProject(res.id);
          }
        } catch (err) {
          message.error('Lỗi khi tạo dự án.');
        }
      }
    });
  };

  const handleSelectProject = async (id) => {
    setLoadingDetail(true);
    try {
      const data = await FlowService.getProjectDetail(id);
      if (data) {
        setActiveProject(data);
      } else {
        message.error('Không tìm thấy chi tiết dự án.');
      }
    } catch (err) {
      message.error('Lỗi khi tải dự án.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRenameProject = async (id, name) => {
    if (!name.trim()) return;
    try {
      await FlowService.updateProject(id, name);
      message.success('Đã cập nhật tên dự án.');
      setRenameProjectId(null);
      fetchProjects();
      if (activeProject && activeProject.id === id) {
        setActiveProject(prev => ({ ...prev, name }));
      }
    } catch (err) {
      message.error('Lỗi khi đổi tên dự án.');
    }
  };

  const handleDeleteProject = (id, event) => {
    if (event) event.stopPropagation();
    Modal.confirm({
      title: 'Xóa dự án này?',
      content: 'Tất cả các hình ảnh và video đã tạo bên trong dự án này cũng sẽ bị xóa. Hành động này không thể hoàn tác.',
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await FlowService.deleteProject(id);
          message.success('Đã xóa dự án.');
          if (activeProject && activeProject.id === id) {
            setActiveProject(null);
          }
          fetchProjects();
        } catch (err) {
          message.error('Lỗi khi xóa dự án.');
        }
      }
    });
  };

  const handleAddReferenceImage = (slot, file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImages(prev => ({
        ...prev,
        [slot]: {
          file,
          base64: reader.result
        }
      }));
    };
    reader.readAsDataURL(file);
    return false; // Chặn tự tải lên
  };

  const handleRemoveReferenceImage = (slot, event) => {
    if (event) event.stopPropagation();
    setReferenceImages(prev => ({
      ...prev,
      [slot]: null
    }));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.warning('Vui lòng nhập mô tả ý tưởng tạo.');
      return;
    }
    if (!geminiKey) {
      message.warning('Vui lòng vào Cài đặt hệ thống để điền Gemini API Key.');
      return;
    }
    if (!activeProject) return;

    setIsGenerating(true);
    setGenerationProgress(genMode === 'image' ? 'Đang tạo ảnh bằng Nano Banana...' : 'Đang khởi chạy tiến trình Veo Video (sẽ mất khoảng 1-2 phút)...');

    try {
      // Dùng ảnh Face hoặc ảnh Pose làm ảnh tham chiếu chính nếu có
      const refBase64 = referenceImages.face?.base64 || referenceImages.pose?.base64 || referenceImages.style?.base64 || '';

      if (genMode === 'image') {
        const result = await window.electron.geminiGenerateImageFlow({
          prompt,
          model: selectedModel,
          geminiKey,
          referenceImageBase64: refBase64
        });

        if (result.ok && result.filePath) {
          // Lưu vào database backend
          const newAsset = await FlowService.addAsset(activeProject.id, 'image', result.filePath, prompt, ratio);
          if (newAsset) {
            setActiveProject(prev => ({
              ...prev,
              assets: [newAsset, ...prev.assets]
            }));
            message.success('Đã sinh ảnh thành công!');
          }
        } else {
          throw new Error(result.error || 'Có lỗi xảy ra trong quá trình sinh ảnh.');
        }
      } else {
        const result = await window.electron.geminiGenerateVideoFlow({
          prompt,
          model: selectedModel,
          geminiKey,
          referenceImageBase64: refBase64,
          aspectRatio: ratio,
          durationSeconds: 5
        });

        if (result.ok && result.filePath) {
          const newAsset = await FlowService.addAsset(activeProject.id, 'video', result.filePath, prompt, ratio);
          if (newAsset) {
            setActiveProject(prev => ({
              ...prev,
              assets: [newAsset, ...prev.assets]
            }));
            message.success('Đã sinh video thành công!');
          }
        } else {
          throw new Error(result.error || 'Có lỗi xảy ra trong quá trình sinh video.');
        }
      }

      setPrompt('');
      setShowSettingsPopover(false);
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Lỗi khi gọi API sinh dữ liệu.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const handleDeleteAsset = (assetId) => {
    if (!activeProject) return;
    Modal.confirm({
      title: 'Xóa tệp này?',
      content: 'Tệp ảnh/video này sẽ bị xóa khỏi dự án.',
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await FlowService.deleteAsset(activeProject.id, assetId);
          setActiveProject(prev => ({
            ...prev,
            assets: prev.assets.filter(a => a.id !== assetId)
          }));
          message.success('Đã xóa tệp.');
        } catch (err) {
          message.error('Lỗi khi xóa tệp.');
        }
      }
    });
  };

  // Filter Assets inside project based on Sidebar tab and search query
  const filteredAssets = activeProject?.assets?.filter(asset => {
    // 1. Filter by search query
    if (searchQuery.trim() && !asset.prompt.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // 2. Filter by sidebar tab
    if (activeSidebarTab === 'image' && asset.type !== 'image') return false;
    if (activeSidebarTab === 'video' && asset.type !== 'video') return false;
    
    return true;
  }) || [];

  return (
    <div className="flow-studio-container">
      {/* -------------------------------------------------------------
          DASHBOARD SCREEN: Project List Grid
          ------------------------------------------------------------- */}
      {!activeProject && (
        <div className="flow-dashboard">
          <header className="flow-dash-header">
            <h1 className="flow-logo">Google Flow</h1>
            <div className="flow-dash-actions">
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={handleCreateProject}
                style={{ background: '#3b82f6', borderColor: '#3b82f6', borderRadius: '10px', height: '40px', fontWeight: 600 }}
              >
                Dự án mới
              </Button>
              <div className="flow-avatar">GF</div>
            </div>
          </header>

          {loadingProjects ? (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
              <LoadingOutlined style={{ fontSize: '36px', color: '#3b82f6' }} spin />
              <p style={{ marginTop: '16px', color: '#94a3b8' }}>Đang tải danh sách dự án...</p>
            </div>
          ) : (
            <div className="flow-grid-container">
              {/* "+ Dự án mới" Card Button */}
              <div className="flow-new-project-card" onClick={handleCreateProject}>
                <PlusOutlined style={{ fontSize: '32px', color: '#64748b' }} />
                <span>+ Dự án mới</span>
              </div>

              {/* List of existing Projects */}
              {projects.map(proj => (
                <div 
                  key={proj.id} 
                  className="flow-project-card"
                  onClick={() => handleSelectProject(proj.id)}
                >
                  {/* Delete / Edit Menu inside card overlay */}
                  <div className="flow-project-card-menu">
                    <Dropdown
                      overlay={
                        <Menu>
                          <Menu.Item 
                            key="rename" 
                            icon={<SettingOutlined />}
                            onClick={(e) => {
                              e.domEvent.stopPropagation();
                              setRenameProjectId(proj.id);
                              setRenameProjectName(proj.name);
                            }}
                          >
                            Đổi tên
                          </Menu.Item>
                          <Menu.Item 
                            key="delete" 
                            danger 
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.domEvent.stopPropagation();
                              handleDeleteProject(proj.id);
                            }}
                          >
                            Xóa dự án
                          </Menu.Item>
                        </Menu>
                      }
                      trigger={['click']}
                    >
                      <EllipsisOutlined 
                        style={{ color: '#fff', fontSize: '18px', cursor: 'pointer' }} 
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Dropdown>
                  </div>

                  <div className="flow-project-preview">
                    {proj.thumbnail ? (
                      <img src={getMediaUrl(proj.thumbnail)} alt="Project thumbnail" />
                    ) : (
                      <div className="flow-project-placeholder" />
                    )}
                  </div>

                  <div className="flow-project-meta">
                    {renameProjectId === proj.id ? (
                      <Input
                        value={renameProjectName}
                        onChange={(e) => setRenameProjectName(e.target.value)}
                        onBlur={() => handleRenameProject(proj.id, renameProjectName)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameProject(proj.id, renameProjectName)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        style={{ height: '24px', fontSize: '13px' }}
                      />
                    ) : (
                      <span className="flow-project-title" title={proj.name}>
                        {proj.name}
                      </span>
                    )}
                    <span className="flow-project-date">
                      {proj.createdAt ? new Date(proj.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' }) : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          WORKSPACE SCREEN: Canvas / Grid Editor
          ------------------------------------------------------------- */}
      {activeProject && (
        <div className="flow-workspace">
          {/* Top Header */}
          <header className="flow-ws-header">
            <div className="flow-ws-header-left">
              <button className="flow-back-btn" onClick={() => setActiveProject(null)} title="Quay lại">
                <ArrowLeftOutlined />
              </button>
              <div className="flow-ws-title-container">
                <input 
                  type="text" 
                  className="flow-ws-title"
                  defaultValue={activeProject.name}
                  onBlur={(e) => handleRenameProject(activeProject.id, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameProject(activeProject.id, e.target.value)}
                />
              </div>
            </div>

            <div className="flow-ws-header-center">
              <SearchOutlined className="flow-search-icon" />
              <input 
                type="text" 
                placeholder="Tìm kiếm nội dung..." 
                className="flow-search-bar"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flow-ws-header-right">
              <Button 
                type="text" 
                icon={<SettingOutlined />} 
                style={{ color: '#94a3b8' }} 
                onClick={() => message.info('Mở cấu hình dự án')}
              />
              <div className="flow-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>GF</div>
            </div>
          </header>

          {/* Sidebar and Grid Area */}
          <div className="flow-ws-content">
            {/* Sidebar Left */}
            <aside className={`flow-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
              <div className="flow-sidebar-menu">
                <button 
                  className={`flow-sidebar-item ${activeSidebarTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('all')}
                >
                  <FolderOpenOutlined className="flow-sidebar-icon" />
                  <span className="flow-sidebar-label">Tất cả nội dung</span>
                </button>
                <button 
                  className={`flow-sidebar-item ${activeSidebarTab === 'image' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('image')}
                >
                  <PictureOutlined className="flow-sidebar-icon" />
                  <span className="flow-sidebar-label">Hình ảnh</span>
                </button>
                <button 
                  className={`flow-sidebar-item ${activeSidebarTab === 'video' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('video')}
                >
                  <VideoCameraOutlined className="flow-sidebar-icon" />
                  <span className="flow-sidebar-label">Cảnh Video</span>
                </button>
              </div>

              <div className="flow-sidebar-footer">
                <button 
                  className="flow-sidebar-item"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  {sidebarCollapsed ? (
                    <MenuUnfoldOutlined className="flow-sidebar-icon" />
                  ) : (
                    <MenuFoldOutlined className="flow-sidebar-icon" />
                  )}
                  <span className="flow-sidebar-label">Thu gọn</span>
                </button>
              </div>
            </aside>

            {/* Main Area containing Grid of Assets */}
            <main className="flow-main-grid">
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                  <LoadingOutlined style={{ fontSize: '36px', color: '#3b82f6' }} spin />
                  <p style={{ marginTop: '16px', color: '#94a3b8' }}>Đang tải nội dung dự án...</p>
                </div>
              ) : (
                <>
                  {/* Realtime Generating Loader Card */}
                  {isGenerating && (
                    <div className="flow-spinning-overlay">
                      <div className="flow-spinner" />
                      <div style={{ color: '#fff', fontWeight: 600 }}>{generationProgress}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Vui lòng giữ ứng dụng mở...</div>
                    </div>
                  )}

                  {filteredAssets.length === 0 && !isGenerating ? (
                    <div style={{ padding: '100px 0', textAlign: 'center' }}>
                      <Empty description="Chưa có hình ảnh hoặc video nào được tạo. Sử dụng thanh công cụ bên dưới để bắt đầu!" />
                    </div>
                  ) : (
                    <div className="flow-assets-grid">
                      {filteredAssets.map(asset => (
                        <div key={asset.id} className="flow-asset-wrapper">
                          <span className={`flow-asset-badge ${asset.type === 'video' ? 'video' : ''}`}>
                            {asset.type === 'video' ? 'Video' : 'Ảnh'}
                          </span>

                          <div className="flow-asset-media">
                            {asset.type === 'video' ? (
                              <video 
                                src={getMediaUrl(asset.url)} 
                                className="flow-asset-video" 
                                preload="metadata"
                                muted
                                onClick={() => setPreviewMedia(asset)}
                              />
                            ) : (
                              <img 
                                src={getMediaUrl(asset.url)} 
                                alt={asset.prompt} 
                                className="flow-asset-img"
                                onClick={() => setPreviewMedia(asset)}
                              />
                            )}
                          </div>

                          {/* Hover Overlay */}
                          <div className="flow-asset-overlay">
                            <div className="flow-asset-header-actions">
                              <Tooltip title="Xem chi tiết">
                                <button className="flow-asset-action-btn" onClick={() => setPreviewMedia(asset)}>
                                  {asset.type === 'video' ? <PlayCircleOutlined /> : <EyeOutlined />}
                                </button>
                              </Tooltip>
                              <Tooltip title="Xóa">
                                <button className="flow-asset-action-btn delete" onClick={() => handleDeleteAsset(asset.id)}>
                                  <DeleteOutlined />
                                </button>
                              </Tooltip>
                            </div>

                            <div className="flow-asset-info" title={asset.prompt}>
                              {asset.prompt.length > 80 ? `${asset.prompt.substr(0, 80)}...` : asset.prompt}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </main>
          </div>

          {/* -------------------------------------------------------------
              BOTTOM FLOATING COMMAND PANEL (COMMAND CENTER)
              ------------------------------------------------------------- */}
          <div className="flow-command-center">
            {/* 1. Generative settings popover */}
            {showSettingsPopover && (
              <div className="flow-gen-settings-pop">
                {/* Image/Video mode selector */}
                <div className="flow-gen-tabs">
                  <button 
                    className={`flow-gen-tab-btn ${genMode === 'image' ? 'active' : ''}`}
                    onClick={() => setGenMode('image')}
                  >
                    Hình ảnh
                  </button>
                  <button 
                    className={`flow-gen-tab-btn ${genMode === 'video' ? 'active' : ''}`}
                    onClick={() => setGenMode('video')}
                  >
                    Video
                  </button>
                </div>

                <div className="flow-gen-settings-grid">
                  {/* Ratio */}
                  <div className="flow-gen-section">
                    <span className="flow-gen-section-title">Tỷ lệ khung hình</span>
                    <div className="flow-gen-option-group">
                      {['16:9', '4:3', '1:1', '3:4', '9:16'].map(r => (
                        <button 
                          key={r} 
                          className={`flow-option-btn ${ratio === r ? 'active' : ''}`}
                          onClick={() => setRatio(r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="flow-gen-section">
                    <span className="flow-gen-section-title">Số lượng</span>
                    <div className="flow-gen-option-group">
                      {['1x', '2x', '3x', '4x'].map(q => (
                        <button 
                          key={q} 
                          className={`flow-option-btn ${quantity === q ? 'active' : ''}`}
                          onClick={() => setQuantity(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Model Selection Dropdown */}
                  <div className="flow-gen-section">
                    <span className="flow-gen-section-title">Mô hình AI</span>
                    <Select 
                      value={selectedModel}
                      onChange={(val) => setSelectedModel(val)}
                      className="flow-model-select"
                      style={{ width: '210px' }}
                      popupClassName="flow-model-dropdown"
                    >
                      {genMode === 'image' ? (
                        <>
                          <Select.Option value="gemini-3.1-flash-image">⚡ Nano Banana 2 (Flash)</Select.Option>
                          <Select.Option value="gemini-3-pro-image">🔥 Nano Banana Pro</Select.Option>
                          <Select.Option value="gemini-2.5-flash-image">🍌 Nano Banana</Select.Option>
                        </>
                      ) : (
                        <>
                          <Select.Option value="veo-3.0-generate-001">🎬 Veo 3.0 Standard</Select.Option>
                          <Select.Option value="veo-3.0-fast-generate-001">⚡ Veo 3.0 Fast</Select.Option>
                          <Select.Option value="veo-2.0-generate-001">🎥 Veo 2.0</Select.Option>
                        </>
                      )}
                    </Select>
                  </div>
                </div>

                {/* Reference upload slots */}
                <div className="flow-gen-section">
                  <span className="flow-gen-section-title">Ảnh tham chiếu (Tùy chọn)</span>
                  <div className="flow-ref-image-slots">
                    {/* Slot 1: Face */}
                    <Upload
                      beforeUpload={(file) => handleAddReferenceImage('face', file)}
                      showUploadList={false}
                    >
                      <div className="flow-ref-slot">
                        {referenceImages.face ? (
                          <>
                            <img src={referenceImages.face.base64} alt="Face ref" />
                            <button className="flow-remove-ref-btn" onClick={(e) => handleRemoveReferenceImage('face', e)}><CloseOutlined /></button>
                          </>
                        ) : (
                          <>
                            <PlusOutlined />
                            <span>Mặt mẫu</span>
                          </>
                        )}
                      </div>
                    </Upload>

                    {/* Slot 2: Pose */}
                    <Upload
                      beforeUpload={(file) => handleAddReferenceImage('pose', file)}
                      showUploadList={false}
                    >
                      <div className="flow-ref-slot">
                        {referenceImages.pose ? (
                          <>
                            <img src={referenceImages.pose.base64} alt="Pose ref" />
                            <button className="flow-remove-ref-btn" onClick={(e) => handleRemoveReferenceImage('pose', e)}><CloseOutlined /></button>
                          </>
                        ) : (
                          <>
                            <PlusOutlined />
                            <span>Dáng mẫu</span>
                          </>
                        )}
                      </div>
                    </Upload>

                    {/* Slot 3: Style */}
                    <Upload
                      beforeUpload={(file) => handleAddReferenceImage('style', file)}
                      showUploadList={false}
                    >
                      <div className="flow-ref-slot">
                        {referenceImages.style ? (
                          <>
                            <img src={referenceImages.style.base64} alt="Style ref" />
                            <button className="flow-remove-ref-btn" onClick={(e) => handleRemoveReferenceImage('style', e)}><CloseOutlined /></button>
                          </>
                        ) : (
                          <>
                            <PlusOutlined />
                            <span>Style mẫu</span>
                          </>
                        )}
                      </div>
                    </Upload>
                  </div>
                </div>

                <div className="flow-gen-settings-footer">
                  <span className="flow-credit-note">Quá trình tạo sẽ tiêu tốn 0 tín dụng</span>
                  <Button 
                    type="text" 
                    icon={<CloseOutlined />} 
                    onClick={() => setShowSettingsPopover(false)} 
                    style={{ color: '#64748b' }}
                  />
                </div>
              </div>
            )}

            {/* 2. Capsule input bar */}
            <div className="flow-capsule-input-bar">
              {/* Settings Toggle Trigger Tag */}
              <div className="flow-agent-tag" onClick={() => setShowSettingsPopover(!showSettingsPopover)}>
                <SettingOutlined />
                <span>Cấu hình AI</span>
              </div>

              {/* Main text prompt */}
              <input 
                type="text" 
                placeholder="Bạn muốn tạo gì hôm nay?" 
                className="flow-capsule-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGenerating) {
                    handleGenerate();
                  }
                }}
                disabled={isGenerating}
              />

              {/* Submit Button */}
              <button 
                className="flow-submit-btn" 
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? <LoadingOutlined spin /> : <PlusOutlined />}
                <span>{genMode === 'image' ? 'Tạo ảnh' : 'Tạo video'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          PREVIEW MEDIA MODAL
          ------------------------------------------------------------- */}
      <Modal
        open={!!previewMedia}
        onCancel={() => setPreviewMedia(null)}
        footer={null}
        width={860}
        centered
        bodyStyle={{ background: '#0b0c10', color: '#fff', padding: '24px' }}
      >
        {previewMedia && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#000', textAlign: 'center' }}>
              {previewMedia.type === 'video' ? (
                <video 
                  src={getMediaUrl(previewMedia.url)} 
                  controls 
                  autoPlay 
                  style={{ maxWidth: '100%', maxHeight: '500px' }} 
                />
              ) : (
                <img 
                  src={getMediaUrl(previewMedia.url)} 
                  alt={previewMedia.prompt} 
                  style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }} 
                />
              )}
            </div>

            <div style={{ width: '100%', padding: '12px', background: '#12141c', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <h4 style={{ color: '#3b82f6', marginBottom: '6px', fontSize: '12px', fontWeight: 600 }}>CÂU LỆNH TẠO (PROMPT)</h4>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: '#cbd5e1' }}>{previewMedia.prompt}</p>
            </div>

            <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'flex-end' }}>
              <Button 
                icon={<DownloadOutlined />}
                onClick={() => {
                  // Mở file bằng trình duyệt hoặc lưu file
                  window.open(getMediaUrl(previewMedia.url));
                }}
              >
                Tải xuống
              </Button>
              <Button type="primary" danger icon={<DeleteOutlined />} onClick={() => {
                const idToDelete = previewMedia.id;
                setPreviewMedia(null);
                handleDeleteAsset(idToDelete);
              }}>
                Xóa tệp
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FlowStudio;
