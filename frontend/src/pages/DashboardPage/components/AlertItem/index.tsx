import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AlertItem.module.css';

/**
 * 预警项数据类型接口
 */
export interface AlertItemData {
  id: string;
  assetName: string;
  assetCode?: string;
  expireDate: string;
  urgencyLevel: 'critical' | 'warning' | 'notice';
  maintenanceType?: string;
  vendorName?: string;
}

/**
 * 计算距离到期日的剩余天数
 * @param expireDate - 到期日期（ISO 8601格式）
 * @returns 剩余天数（负数表示已过期）
 */
export const calculateDaysRemaining = (expireDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expire = new Date(expireDate);
  expire.setHours(0, 0, 0, 0);
  const diffTime = expire.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * 根据紧急度获取颜色类名
 * @param urgencyLevel - 紧急度等级
 * @returns 对应的 CSS 类名
 */
export const getUrgencyColorClass = (urgencyLevel: AlertItemData['urgencyLevel']): string => {
  const colorMap: Record<AlertItemData['urgencyLevel'], string> = {
    critical: styles.critical,
    warning: styles.warning,
    notice: styles.notice,
  };
  return colorMap[urgencyLevel] || styles.notice;
};

/**
 * 格式化剩余天数显示文本
 * @param daysRemaining - 剩余天数
 * @returns 格式化的显示文本
 */
export const formatDaysRemaining = (daysRemaining: number): string => {
  if (daysRemaining < 0) {
    return `已过期 ${Math.abs(daysRemaining)} 天`;
  } else if (daysRemaining === 0) {
    return '今日到期';
  } else {
    return `剩余 ${daysRemaining} 天`;
  }
};

interface AlertItemProps {
  /** 预警数据项 */
  data: AlertItemData;
  /** 点击回调函数 */
  onClick?: (item: AlertItemData) => void;
}

/**
 * AlertItem 组件
 * 维保到期预警列表项组件，支持紧急度颜色标记、点击跳转、剩余天数计算
 * 
 * @example
 * ```tsx
 * <AlertItem 
 *   data={{
 *     id: '1',
 *     assetName: '服务器 Dell R740',
 *     expireDate: '2024-01-22',
 *     urgencyLevel: 'warning'
 *   }}
 *   onClick={(item) => console.log(item)}
 * />
 * ```
 */
const AlertItem: React.FC<AlertItemProps> = ({ data, onClick }) => {
  const navigate = useNavigate();
  const daysRemaining = calculateDaysRemaining(data.expireDate);
  const urgencyColorClass = getUrgencyColorClass(data.urgencyLevel);
  const daysText = formatDaysRemaining(daysRemaining);

  const handleClick = () => {
    if (onClick) {
      onClick(data);
    } else {
      navigate(`/asset/${data.id}`);
    }
  };

  return (
    <div 
      className={`${styles.alertItem} ${urgencyColorClass}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      <div className={styles.alertContent}>
        <div className={styles.alertHeader}>
          <span className={styles.assetName}>{data.assetName}</span>
          {data.assetCode && (
            <span className={styles.assetCode}>{data.assetCode}</span>
          )}
        </div>
        
        <div className={styles.alertDetails}>
          {data.maintenanceType && (
            <span className={styles.maintenanceType}>{data.maintenanceType}</span>
          )}
          {data.vendorName && (
            <span className={styles.vendorName}>{data.vendorName}</span>
          )}
          <span className={styles.expireDate}>
            到期日: {data.expireDate}
          </span>
        </div>
      </div>

      <div className={styles.alertStatus}>
        <span className={`${styles.urgencyBadge} ${urgencyColorClass}`}>
          {data.urgencyLevel === 'critical' && '紧急'}
          {data.urgencyLevel === 'warning' && '预警'}
          {data.urgencyLevel === 'notice' && '提醒'}
        </span>
        <span className={`${styles.daysRemaining} ${urgencyColorClass}`}>
          {daysText}
        </span>
      </div>
    </div>
  );
};

export default AlertItem;