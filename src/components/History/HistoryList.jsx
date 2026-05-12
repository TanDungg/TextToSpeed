import { List, Empty, Typography, Divider, Button, Tooltip } from 'antd';
import { HistoryOutlined, DeleteOutlined } from '@ant-design/icons';
import { Sparkles } from 'lucide-react';

const { Title, Text } = Typography;

const HistoryList = ({ history, onClearHistory, onSelectItem, hideHeader = false }) => {
  return (
    <div className="history-wrapper">
      {!hideHeader && (
        <div className="history-header">
          <Title level={4} className="history-title">
            <HistoryOutlined /> Lịch sử
          </Title>
        </div>
      )}

      <div className="history-list-scroll">
        {history.length > 0 ? (
          <List
            dataSource={history}
            renderItem={(item) => (
              <List.Item className="history-item" onClick={() => onSelectItem(item)}>
                <div className="history-item-content">
                  <div className="history-item-meta">
                    <Text className="history-item-voice">
                      {item.external && <Sparkles size={10} color="#f59e0b" />}
                      {item.voice?.split(' ')[0]}
                    </Text>
                    <Text className="history-item-date">{item.date?.split(',')[1]}</Text>
                  </div>
                  <Text className="history-item-text">{item.text}</Text>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có lịch sử"
            className="history-empty"
          />
        )}
      </div>
    </div>
  );
};

export default HistoryList;
