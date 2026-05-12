import { Modal, Button, Popconfirm, Empty } from 'antd';
import { HistoryOutlined, DeleteOutlined } from '@ant-design/icons';
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
                    <span className="voice-name">{item.voiceName || item.voice || 'Giọng mặc định'}</span>
                    <span className="provider-badge">{item.provider || 'FPT'}</span>
                  </div>
                  <div className="time-info">
                    <Clock size={12} />
                    <span>{new Date(item.timestamp || item.date || item.id).toLocaleDateString()}</span>
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
                  <Button type="link" size="small" className="reuse-btn">
                    Sử dụng lại
                  </Button>
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
