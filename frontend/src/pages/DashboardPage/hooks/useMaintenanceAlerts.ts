/**
 * useMaintenanceAlerts - 维护/到期预警资产数据 Hook
 *
 * 根据 [SWARM-P2-007-FE] 规格要求：
 * - 使用 TanStack Query 进行远端数据缓存与状态管理
 * - 前端结合当前日期与后端返回的"到期日"实时计算剩余天数
 * - 不依赖后端静态字段返回剩余天数
 */

import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';

/**
 * 后端返回的到期预警资产原始数据接口
 * 与 dashboard.types.ts 中 IExpiringAsset 保持一致
 */
export interface IExpiringAsset {
  /** 资产唯一标识 */
  id: string;
  /** 资产名称 */
  assetName: string;
  /** 资产编号 */
  assetCode: string;
  /** 资产分类 */
  category: string;
  /** 到期日期 (ISO 8601 格式，如 2025-03-15 或 2025-03-15T00:00:00Z) */
  expiryDate: string;
  /** 预警类型描述 */
  alertType: string;
  /** 责任人（可选） */
  responsiblePerson?: string;
}

/**
 * 前端计算后的已处理预警资产数据
 * 包含前端实时计算的剩余天数及紧急状态标识
 */
export interface IProcessedAlert extends IExpiringAsset {
  /** 距到期的剩余天数（负数表示已过期） */
  remainingDays: number;
  /** 标准格式到期日 (YYYY-MM-DD) */
  formattedExpiryDate: string;
  /** 面向用户的状态描述文本，如 "剩余 3 天" / "已过期 2 天" / "今天到期" */
  statusText: string;
  /** 是否紧急（未过期且剩余天数 ≤ URGENT_THRESHOLD_DAYS） */
  isUrgent: boolean;
  /** 是否已过期（remainingDays < 0） */
  isExpired: boolean;
}

/** useMaintenanceAlerts Hook 返回值类型 */
export interface UseMaintenanceAlertsResult {
  /** 经过前端计算、排序后的预警列表 */
  alerts: IProcessedAlert[];
  /** 数据加载中状态，用于判断是否展示骨架屏 / Spin */
  isLoading: boolean;
  /** 是否发生错误，用于展示"数据加载失败"提示 */
  isError: boolean;
  /** 错误详情对象 */
  error: Error | null;
  /** 手动刷新方法（用户点击刷新或资产状态变更后调用） */
  refetch: () => void;
}

/** 紧急预警阈值：剩余天数 ≤ 此值视为紧急（规格要求 ≤ 7 天） */
const URGENT_THRESHOLD_DAYS = 7;

/**
 * 从后端 API 获取到期预警资产列表
 *
 * @returns 到期预警资产原始数据数组
 * @throws 当请求失败时抛出 Error
 */
async function fetchExpiringAssets(): Promise<IExpiringAsset[]> {
  const response = await fetch('/api/v1/dashboard/expiring-assets');
  if (!response.ok) {
    throw new Error(
      `获取预警资产数据失败: ${response.status} ${response.statusText}`
    );
  }
  const json = await response.json();
  return json.data ?? json;
}

/**
 * 将单条后端原始预警数据加工为前端展示所需的增强格式
 *
 * 核心逻辑：结合当前日期与到期日实时计算剩余天数，
 * 符合规格"预警列表的剩余天数需前端实时计算"的要求。
 *
 * @param alert - 后端返回的原始预警资产数据
 * @returns 带有剩余天数、紧急状态等前端计算字段的增强数据
 */
function processAlert(alert: IExpiringAsset): IProcessedAlert {
  const expiryDate = parseISO(alert.expiryDate);
  const today = new Date();

  // 使用日历天数差值，确保跨日计算准确
  const remainingDays = differenceInCalendarDays(expiryDate, today);

  const isExpired = remainingDays < 0;
  const isUrgent = !isExpired && remainingDays <= URGENT_THRESHOLD_DAYS;

  // 生成面向用户的状态文本
  let statusText: string;
  if (isExpired) {
    statusText = `已过期 ${Math.abs(remainingDays)} 天`;
  } else if (remainingDays === 0) {
    statusText = '今天到期';
  } else {
    statusText = `剩余 ${remainingDays} 天`;
  }

  return {
    ...alert,
    remainingDays,
    formattedExpiryDate: format(expiryDate, 'yyyy-MM-dd'),
    statusText,
    isUrgent,
    isExpired,
  };
}

/**
 * 按紧急程度对预警列表排序
 *
 * 排序优先级：已过期 → 紧急(≤7天) → 正常
 * 同级别内按剩余天数升序排列（最紧急的排在最前面）
 *
 * @param alerts - 已处理的预警列表
 * @returns 排序后的新数组（不修改原数组）
 */
function sortAlertsByUrgency(alerts: IProcessedAlert[]): IProcessedAlert[] {
  return [...alerts].sort((a, b) => {
    // 第一优先级：已过期排在最前
    if (a.isExpired !== b.isExpired) {
      return a.isExpired ? -1 : 1;
    }
    // 第二优先级：紧急项排前
    if (a.isUrgent !== b.isUrgent) {
      return a.isUrgent ? -1 : 1;
    }
    // 同级别按剩余天数升序（越少越紧急）
    return a.remainingDays - b.remainingDays;
  });
}

/**
 * useMaintenanceAlerts - 维护/到期预警资产数据 Hook
 *
 * 获取后端预警资产数据，前端实时计算剩余天数，按紧急程度排序后返回。
 * 严格遵循 [SWARM-P2-007-FE] 规格：
 * - 使用 TanStack Query 管理异步状态（禁止 useState 存储远端数据）
 * - 剩余天数由前端结合当前日期与到期日实时计算
 * - isUrgent 标识用于组件层对 ≤7 天条目的高亮渲染（警告色）
 *
 * @example
 * ```tsx
 * const { alerts, isLoading, isError } = useMaintenanceAlerts();
 *
 * if (isLoading) return <Skeleton />;
 * if (isError) return <ErrorFallback message="数据加载失败" />;
 *
 * return (
 *   <div data-testid="warning-scroll-list">
 *     {alerts.map(alert => (
 *       <AlertItem key={alert.id} alert={alert} />
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useMaintenanceAlerts(): UseMaintenanceAlertsResult {
  const { data, isLoading, isError, error, refetch } = useQuery<
    IExpiringAsset[]
  >({
    queryKey: ['dashboard', 'maintenance-alerts'],
    queryFn: fetchExpiringAssets,
    staleTime: 5 * 60 * 1000, // 5 分钟缓存，平衡实时性与请求频率
    refetchOnWindowFocus: true, // 窗口重新聚焦时自动刷新预警数据
  });

  // 数据加工流水线：原始数据 → 计算剩余天数 → 排序
  const alerts: IProcessedAlert[] = data
    ? sortAlertsByUrgency(data.map(processAlert))
    : [];

  return {
    /** 处理后的预警列表，可直接用于 WarningList / AlertItem 组件渲染 */
    alerts,
    /** 加载状态 */
    isLoading,
    /** 错误状态 */
    isError,
    /** 错误对象 */
    error: error ?? null,
    /** 手动刷新方法 */
    refetch,
  };
}

export default useMaintenanceAlerts;