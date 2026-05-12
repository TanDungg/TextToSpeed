import { Modal, Button, Popconfirm } from 'antd';
import { HistoryOutlined, DeleteOutlined } from '@ant-design/icons';
import HistoryList from './HistoryList';
import './HistoryModalStyles.scss';

const HistoryModal = ({ open, onCancel, history, onClearHistory, onSelectItem }) => {
  return (
    <Modal
      title={
        <div className="modal-title-wrapper">
          <HistoryOutlined /> Lịch sử đọc
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={600}
      centered
      className="history-modal"
      footer={
        history.length > 0 ? (
          <div className="history-modal-footer">
            <Popconfirm
              title="Xóa tất cả lịch sử?"
              description="Hành động này không thể hoàn tác."
              onConfirm={onClearHistory}
              okText="Xóa hết"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} type="text">
                Xóa toàn bộ lịch sử
              </Button>
            </Popconfirm>
          </div>
        ) : null
      }
    >
      <div className="history-list-scroll">
        <HistoryList
          history={history}
          onClearHistory={onClearHistory}
          onSelectItem={(item) => {
            onSelectItem(item);
            onCancel();
          }}
          hideHeader
        />
      </div>
    </Modal>
  );
};

export default HistoryModal;
