import { Modal } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import HistoryList from './HistoryList';

const HistoryModal = ({ open, onCancel, history, onClearHistory, onSelectItem }) => {
  return (
    <Modal
      title={
        <div className="modal-title-wrapper">
          <HistoryOutlined /> Lịch sử
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={450}
      centered
      className="history-modal"
    >
      <HistoryList
        history={history}
        onClearHistory={onClearHistory}
        onSelectItem={(item) => {
          onSelectItem(item);
          onCancel(); // Đóng modal sau khi chọn
        }}
        hideHeader
      />
    </Modal>
  );
};

export default HistoryModal;
