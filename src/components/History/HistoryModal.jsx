import { Modal, Button, Popconfirm, Empty, message } from 'antd';
import {
  HistoryOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Trash2, Clock } from 'lucide-react';
import './HistoryModalStyles.scss';

const HistoryModal = ({ open, onCancel, history, onClear, onSelect }) => {
  return (
    <Modal
      title={
        <div className="modal-title-wrapper">
          <HistoryOutlined /> <span>Lịch sử chuyển đổi</span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={700}
      centered
      className="premium-modal history-modal"
      footer={
        history.length > 0 ? (
          <div className="history-modal-footer">
            <Popconfirm
              title="Xóa tất cả lịch sử?"
              description="Bạn có chắc chắn muốn xóa toàn bộ dữ liệu lịch sử?"
              onConfirm={onClear}
              okText="Xóa ngay"
              cancelText="Hủy"
              okButtonProps={{ danger: true, size: 'middle' }}
            >
              <Button danger icon={<Trash2 size={16} />} type="text" className="clear-btn">
                Xóa sạch lịch sử
              </Button>
            </Popconfirm>
          </div>
        ) : null
      }
    >
      <div className="history-modal-content">
        {history.length === 0 ? (
          <Empty description="Chưa có lịch sử chuyển đổi nào" style={{ padding: '40px 0' }} />
        ) : (
          <div className="history-grid">
            {history.map((item, index) => (
              <div
                key={item.id || index}
                className="history-card-item"
                onClick={() => onSelect(item)}
              >
                <div className="item-header">
                  <div className="voice-info">
                    <span className="voice-name">
                      {item.voiceName || item.voice || 'Giọng mặc định'}
                    </span>
                    <span className="provider-badge">{item.provider || 'FPT'}</span>
                  </div>
                  <div className="time-info">
                    <Clock size={12} />
                    <span>
                      {new Date(item.timestamp || item.date || item.id).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="item-body">
                  <p className="text-preview">{item.text || item.fullText}</p>
                </div>
                <div className="item-footer">
                  <div className="params">
                    <span>Tốc độ: {item.rate || item.speed || 1}x</span>
                    <span>Cao độ: {item.pitch ?? 0}</span>
                  </div>
                  {item.provider !== 'System' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {item.audioUrl && (
                        <Button
                          size="small"
                          icon={<PlayCircleOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            const audio = new Audio(item.audioUrl);
                            audio.play().catch((err) => {
                              console.error('Playback error:', err);
                              message.error('Không thể phát lại bản ghi này (có thể đã hết hạn)');
                            });
                          }}
                        >
                          Phát lại
                        </Button>
                      )}
                      <Button
                        type="primary"
                        size="small"
                        icon={<DownloadOutlined />}
                        className="download-history-btn"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!item.audioUrl)
                            return message.warning('Bản ghi này không có file âm thanh!');

                          const hide = message.loading('Đang chuẩn bị file tải về...', 0);
                          try {
                            if (window.electron && window.electron.downloadFile) {
                              window.electron.downloadFile(
                                item.audioUrl,
                                `voice-${item.id}.mp3`
                              );
                              message.success('Đã bắt đầu tải xuống (Native)...');
                            } else {
                              // Fallback nếu không phải môi trường Electron
                              const link = document.createElement('a');
                              link.href = item.audioUrl;
                              link.download = `voice-${item.id}.mp3`;
                              link.target = '_blank';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          } catch (err) {
                            console.error('Download error:', err);
                            window.open(item.audioUrl, '_blank');
                            message.info('Đang mở file trong tab mới để tải về.');
                          } finally {
                            hide();
                          }
                        }}
                      >
                        Tải Voice
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default HistoryModal;
