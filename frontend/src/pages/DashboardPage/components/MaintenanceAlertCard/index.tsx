/**
 * 维保到期预警卡片组件
 * 
 * 功能说明：
 * - 展示7天内和30天内即将到期的维保记录
 * - 支持快速跳转到维保详情页
 * - 响应式布局，适配桌面端/平板端/移动端
 * 
 * @package DashboardPage
 * @subpackage MaintenanceAlertCard
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react';

// ============== 类型定义 ==============

/**
 * 维保预警项
 */
export interface MaintenanceAlertItem {
  /** 维保记录ID */
  id: number;
  /** 资产ID */
  assetId: number;
  /** 资产名称 */
  assetName: string;
  /** 维保类型 */
  maintenanceType: 'routine' | 'repair' | 'inspection' | 'other';
  /** 维保类型中文名 */
  maintenanceTypeLabel: string;
  /** 到期日期 */
  expirationDate: string;
  /** 剩余天数 */
  remainingDays: number;
  /** 紧急程度 */
  urgency: 'urgent' | 'warning';
}

/**
 * 维保预警卡片数据
 */
export interface MaintenanceAlertData {
  /** 7天内即将到期的记录 */
  urgentAlerts: MaintenanceAlertItem[];
  /** 30天内即将到期的记录 */
  warningAlerts: MaintenanceAlertItem[];
  /** 总预警数 */
  totalCount: number;
}

/**
 * 维保预警卡片Props
 */
export interface MaintenanceAlertCardProps {
  /** 预警数据 */
  data?: MaintenanceAlertData;
  /** 是否加载中 */
  loading?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============== 常量配置 ==============

/** 维保类型映射 */
const MAINTENANCE_TYPE_MAP: Record<string, string> = {
  routine: '日常维保',
  repair: '维修保养',
  inspection: '定期检查',
  other: '其他'
};

/** 紧急程度阈值 */
const URGENT_THRESHOLD = 7; // 7天内
const WARNING_THRESHOLD = 30; // 30天内

// ============== 工具函数 ==============

/**
 * 计算剩余天数
 * @param expirationDate 到期日期字符串
 * @returns 剩余天数
 */
function calculateRemainingDays(expirationDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expireDate = new Date(expirationDate);
  expireDate.setHours(0, 0, 0, 0);
  const diffTime = expireDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 格式化日期显示
 * @param dateStr 日期字符串
 * @returns 格式化后的日期
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取维保类型标签
 * @param type 维保类型
 * @returns 中文标签
 */
function getMaintenanceTypeLabel(type: string): string {
  return MAINTENANCE_TYPE_MAP[type] || '其他';
}

// ============== 子组件 ==============

/**
 * 预警项组件
 */
interface AlertItemProps {
  alert: MaintenanceAlertItem;
  onNavigate: (assetId: number, alertId: number) => void;
}

const AlertItem: React.FC<AlertItemProps> = React.memo(({ alert, onNavigate }) => {
  const isUrgent = alert.urgency === 'urgent';
  
  return (
    <div 
      className={`
        flex items-center justify-between p-3 
        rounded-lg border cursor-pointer
        transition-all duration-200
        hover:shadow-md hover:scale-[1.02]
        ${isUrgent 
          ? 'bg-red-50 border-red-200 hover:bg-red-100' 
          : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
        }
      `}
      onClick={() => onNavigate(alert.assetId, alert.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onNavigate(alert.assetId, alert.id);
        }
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isUrgent && (
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
          <span className="font-medium text-gray-900 truncate">
            {alert.assetName}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
          <span className={`
            px-1.5 py-0.5 rounded text-xs
            ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}
          `}>
            {alert.maintenanceTypeLabel}
          </span>
          <span>到期: {formatDate(alert.expirationDate)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-3">
        <div className={`
          flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
          ${isUrgent ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}
        `}>
          <Clock className="w-3 h-3" />
          <span>{alert.remainingDays}天</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  );
});

AlertItem.displayName = 'AlertItem';

/**
 * 空状态组件
 */
interface EmptyStateProps {
  type: 'no-data' | 'no-alerts';
}

const EmptyState: React.FC<EmptyStateProps> = ({ type }) => (
  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
    <div className="w-12 h-12 mb-3 rounded-full bg-gray-100 flex items-center justify-center">
      {type === 'no-data' ? (
        <Clock className="w-6 h-6" />
      ) : (
        <AlertTriangle className="w-6 h-6" />
      )}
    </div>
    <p className="text-sm font-medium">
      {type === 'no-data' ? '暂无维保数据' : '暂无即将到期的维保记录'}
    </p>
    <p className="text-xs mt-1">
      {type === 'no-data' ? '系统暂无维保计划' : '您的资产维保状态良好'}
    </p>
  </div>
);

// ============== 主组件 ==============

/**
 * 维保到期预警卡片
 * 
 * @description 展示维保预警汇总和明细列表
 * @param props - MaintenanceAlertCardProps
 * @returns React组件
 */
export const MaintenanceAlertCard: React.FC<MaintenanceAlertCardProps> = ({
  data,
  loading = false,
  className = ''
}) => {
  const navigate = useNavigate();

  // 处理加载状态
  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            <div className="h-20 bg-gray-100 rounded-lg" />
            <div className="h-20 bg-gray-100 rounded-lg" />
            <div className="h-20 bg-gray-100 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // 处理空数据状态
  if (!data) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          维保到期预警
        </h3>
        <EmptyState type="no-data" />
      </div>
    );
  }

  // 计算预警数量
  const urgentCount = data.urgentAlerts?.length || 0;
  const warningCount = data.warningAlerts?.length || 0;

  // 处理导航点击
  const handleNavigate = (assetId: number, alertId: number) => {
    navigate(`/maintenance/detail/${alertId}`);
  };

  // 渲染预警汇总区
  const renderSummary = () => (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        维保到期预警
      </h3>
      <div className="flex items-center gap-3">
        {urgentCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 rounded-full">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">
              {urgentCount} 项紧急
            </span>
          </div>
        )}
        {warningCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 rounded-full">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              {warningCount} 项预警
            </span>
          </div>
        )}
        {data.totalCount === 0 && (
          <span className="text-sm text-gray-400">暂无预警</span>
        )}
      </div>
    </div>
  );

  // 渲染预警分类区域
  const renderAlertSection = (
    title: string,
    alerts: MaintenanceAlertItem[],
    type: 'urgent' | 'warning'
  ) => {
    if (!alerts || alerts.length === 0) {
      return null;
    }

    const borderColor = type === 'urgent' ? 'border-red-200' : 'border-amber-200';
    const bgColor = type === 'urgent' ? 'bg-red-50' : 'bg-amber-50';
    const headerBg = type === 'urgent' ? 'bg-red-500' : 'bg-amber-500';

    return (
      <div className={`border rounded-xl overflow-hidden mb-4 ${borderColor}`}>
        <div className={`px-4 py-2 ${headerBg}`}>
          <h4 className="text-sm font-medium text-white flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {title} ({alerts.length})
          </h4>
        </div>
        <div className={`p-3 ${bgColor}`}>
          <div className="space-y-2">
            {alerts.slice(0, type === 'urgent' ? 5 : 3).map((alert) => (
              <AlertItem 
                key={alert.id} 
                alert={alert} 
                onNavigate={handleNavigate}
              />
            ))}
            {alerts.length > 5 && type === 'urgent' && (
              <button 
                className="w-full py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                onClick={() => navigate('/maintenance?filter=urgent')}
              >
                查看全部 {alerts.length} 项紧急预警 →
              </button>
            )}
            {alerts.length > 3 && type === 'warning' && (
              <button 
                className="w-full py-2 text-sm text-amber-600 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                onClick={() => navigate('/maintenance?filter=warning')}
              >
                查看全部 {alerts.length} 项预警 →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 无预警状态
  if (data.totalCount === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
        {renderSummary()}
        <EmptyState type="no-alerts" />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
      {renderSummary()}
      
      {renderAlertSection('7天内即将到期', data.urgentAlerts, 'urgent')}
      {renderAlertSection('30天内即将到期', data.warningAlerts, 'warning')}
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button 
          className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          onClick={() => navigate('/maintenance')}
        >
          查看全部维保记录
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============== Hook 封装 ==============

/**
 * 使用维保预警数据的Hook
 * 
 * @description 提供维保预警数据的获取和处理逻辑
 * @returns 包含数据和加载状态的对象
 */
export function useMaintenanceAlertData() {
  // 此处可以集成数据获取逻辑
  // 暂时返回空数据，后续可通过 props 或 context 注入
  const data = useMemo<MaintenanceAlertData | undefined>(() => {
    // 可在此处添加数据获取逻辑
    return undefined;
  }, []);

  return {
    data,
    loading: false
  };
}

// ============== 默认导出 ==============

export default MaintenanceAlertCard;