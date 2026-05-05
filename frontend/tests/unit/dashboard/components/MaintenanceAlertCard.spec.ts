/**
 * @fileoverview MaintenanceAlertCard 组件单元测试
 * @module frontend/tests/unit/dashboard/components/MaintenanceAlertCard.spec
 * @description 测试维保到期预警卡片的渲染、数据展示和交互功能
 * @requires vitest
 * @requires @testing-library/react
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MaintenanceAlertCard } from '@/pages/DashboardPage/components/MaintenanceAlertCard';
import type { MaintenanceAlert, AlertLevel } from '@/types/dashboard.types';

/**
 * 测试数据集工厂函数
 * @description 生成模拟的维保预警数据用于测试
 * @param overrides - 可选的字段覆盖值
 * @returns 包含预警数据的测试对象
 */
function createMockAlerts(overrides?: Partial<{
  urgentAlerts: MaintenanceAlert[];
  warningAlerts: MaintenanceAlert[];
}>): {
  urgentAlerts: MaintenanceAlert[];
  warningAlerts: MaintenanceAlert[];
} {
  return {
    urgentAlerts: overrides?.urgentAlerts ?? [
      {
        id: 1,
        assetId: 'AST-001',
        assetName: '服务器集群 A',
        maintenanceType: '定期保养',
        expirationDate: '2024-01-20',
        daysRemaining: 5,
        alertLevel: 'urgent' as AlertLevel,
      },
      {
        id: 2,
        assetId: 'AST-002',
        assetName: '网络设备 B',
        maintenanceType: '硬件检修',
        expirationDate: '2024-01-18',
        daysRemaining: 3,
        alertLevel: 'urgent' as AlertLevel,
      },
    ],
    warningAlerts: overrides?.warningAlerts ?? [
      {
        id: 3,
        assetId: 'AST-003',
        assetName: '存储系统 C',
        maintenanceType: '系统升级',
        expirationDate: '2024-02-10',
        daysRemaining: 25,
        alertLevel: 'warning' as AlertLevel,
      },
      {
        id: 4,
        assetId: 'AST-004',
        assetName: '空调设备 D',
        maintenanceType: '季节保养',
        expirationDate: '2024-02-15',
        daysRemaining: 30,
        alertLevel: 'warning' as AlertLevel,
      },
    ],
  };
}

/**
 * TC-005: 维保到期预警卡片渲染测试
 * @description 验证预警卡片正确显示预警汇总和预警列表
 */
describe('TC-005: Maintenance Alert Card Rendering', () => {
  /**
   * 测试 Setup - 每个测试用例前执行
   * @description 重置计时器 mock
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * 测试 Teardown - 每个测试用例后执行
   * @description 清理计时器 mock
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testCase TC-005-M1
   * @description 验证预警卡片组件正确渲染
   */
  it('should render the maintenance alert card component', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const alertCard = screen.getByTestId('maintenance-alert-card');
    expect(alertCard).toBeInTheDocument();
  });

  /**
   * @testCase TC-005-M2
   * @description 验证汇总区域正确显示
   */
  it('should display the alert summary section', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const summary = screen.getByTestId('alert-summary');
    expect(summary).toBeInTheDocument();
  });

  /**
   * @testCase TC-005-M3
   * @description 验证预警标题显示正确
   */
  it('should display the maintenance alert title', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const title = screen.getByText(/维保到期预警/i);
    expect(title).toBeInTheDocument();
  });

  /**
   * @testCase TC-005-M4
   * @description 验证预警列表区域存在
   */
  it('should display the alert list section', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const alertList = screen.getByTestId('alert-list');
    expect(alertList).toBeInTheDocument();
  });
});

/**
 * TC-006: 维保预警数据分类展示测试
 * @description 验证预警列表区分 7 天内和 30 天内即将到期的记录
 */
describe('TC-006: Maintenance Alert Data Classification', () => {
  /**
   * 测试 Setup - 每个测试用例前执行
   * @description 重置计时器 mock
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * 测试 Teardown - 每个测试用例后执行
   * @description 清理计时器 mock
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testCase TC-006-M1
   * @description 验证 7 天内预警区域存在
   */
  it('should display the 7-day urgent alerts section', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const urgentSection = screen.getByTestId('urgent-alerts-section');
    expect(urgentSection).toBeInTheDocument();
    
    const urgentLabel = screen.getByText(/7天内/i);
    expect(urgentLabel).toBeInTheDocument();
  });

  /**
   * @testCase TC-006-M2
   * @description 验证 30 天内预警区域存在
   */
  it('should display the 30-day warning alerts section', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const warningSection = screen.getByTestId('warning-alerts-section');
    expect(warningSection).toBeInTheDocument();
    
    const warningLabel = screen.getByText(/30天内/i);
    expect(warningLabel).toBeInTheDocument();
  });

  /**
   * @testCase TC-006-M3
   * @description 验证紧急预警项数量正确
   */
  it('should display correct number of urgent alert items', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const urgentSection = screen.getByTestId('urgent-alerts-section');
    const alertItems = within(urgentSection).getAllByTestId(/alert-item-/);
    expect(alertItems).toHaveLength(2);
  });

  /**
   * @testCase TC-006-M4
   * @description 验证一般预警项数量正确
   */
  it('should display correct number of warning alert items', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const warningSection = screen.getByTestId('warning-alerts-section');
    const alertItems = within(warningSection).getAllByTestId(/alert-item-/);
    expect(alertItems).toHaveLength(2);
  });

  /**
   * @testCase TC-006-M5
   * @description 验证预警项显示资产名称
   */
  it('should display asset name in alert items', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const firstAlert = screen.getByText('服务器集群 A');
    expect(firstAlert).toBeInTheDocument();
  });

  /**
   * @testCase TC-006-M6
   * @description 验证预警项显示到期天数
   */
  it('should display days remaining in alert items', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const daysRemaining = screen.getByText(/5天/i);
    expect(daysRemaining).toBeInTheDocument();
  });
});

/**
 * TC-007: 维保预警快速跳转测试
 * @description 验证点击预警项可跳转至维保详情页
 */
describe('TC-007: Maintenance Alert Navigation', () => {
  /**
   * 测试 Setup - 每个测试用例前执行
   * @description 重置计时器 mock
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * 测试 Teardown - 每个测试用例后执行
   * @description 清理计时器 mock
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testCase TC-007-M1
   * @description 验证预警项可点击
   */
  it('should allow clicking on alert items', () => {
    const mockData = createMockAlerts();
    const mockNavigate = vi.fn();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
        onNavigate={mockNavigate}
      />
    );

    const firstAlertItem = screen.getByTestId('alert-item-1');
    fireEvent.click(firstAlertItem);
    
    expect(mockNavigate).toHaveBeenCalledWith('/maintenance/detail/1');
  });

  /**
   * @testCase TC-007-M2
   * @description 验证跳转链接包含维保详情页路由
   */
  it('should navigate to maintenance detail page', () => {
    const mockData = createMockAlerts();
    const mockNavigate = vi.fn();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
        onNavigate={mockNavigate}
      />
    );

    const alertItems = screen.getAllByTestId(/alert-item-/);
    alertItems.forEach((item, index) => {
      fireEvent.click(item);
      expect(mockNavigate).toHaveBeenCalledWith(`/maintenance/detail/${index + 1}`);
    });
  });

  /**
   * @testCase TC-007-M3
   * @description 验证预警项包含链接样式
   */
  it('should have clickable link style for alert items', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const firstAlertItem = screen.getByTestId('alert-item-1');
    expect(firstAlertItem).toHaveClass('alert-item');
    expect(firstAlertItem).toHaveAttribute('role', 'link');
  });
});

/**
 * TC-010: 空数据状态处理测试
 * @description 验证空数据时组件显示友好提示
 */
describe('TC-010: Empty Data State Handling', () => {
  /**
   * 测试 Setup - 每个测试用例前执行
   * @description 重置计时器 mock
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * 测试 Teardown - 每个测试用例后执行
   * @description 清理计时器 mock
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testCase TC-010-M1
   * @description 验证无预警数据时显示空状态提示
   */
  it('should display empty state when no alerts exist', () => {
    render(
      <MaintenanceAlertCard
        urgentAlerts={[]}
        warningAlerts={[]}
      />
    );

    const emptyState = screen.getByText(/暂无维保预警/i);
    expect(emptyState).toBeInTheDocument();
  });

  /**
   * @testCase TC-010-M2
   * @description 验证仅有紧急预警时正常显示
   */
  it('should display correctly when only urgent alerts exist', () => {
    const mockData = createMockAlerts({ warningAlerts: [] });
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={[]}
      />
    );

    const urgentSection = screen.getByTestId('urgent-alerts-section');
    expect(urgentSection).toBeInTheDocument();
    
    const warningSection = screen.queryByTestId('warning-alerts-section');
    expect(warningSection).not.toBeInTheDocument();
  });

  /**
   * @testCase TC-010-M3
   * @description 验证仅有一般预警时正常显示
   */
  it('should display correctly when only warning alerts exist', () => {
    const mockData = createMockAlerts({ urgentAlerts: [] });
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={[]}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const warningSection = screen.getByTestId('warning-alerts-section');
    expect(warningSection).toBeInTheDocument();
    
    const urgentSection = screen.queryByTestId('urgent-alerts-section');
    expect(urgentSection).not.toBeInTheDocument();
  });
});

/**
 * 数据格式验证测试
 * @description 验证组件正确处理不同格式的预警数据
 */
describe('Alert Data Format Validation', () => {
  /**
   * 测试 Setup - 每个测试用例前执行
   * @description 重置计时器 mock
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * 测试 Teardown - 每个测试用例后执行
   * @description 清理计时器 mock
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testCase ADV-M1
   * @description 验证紧急预警优先级高于一般预警
   */
  it('should prioritize urgent alerts over warning alerts', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const alertList = screen.getByTestId('alert-list');
    const firstSection = alertList.firstChild;
    expect(firstSection).toHaveAttribute('data-section', 'urgent');
  });

  /**
   * @testCase ADV-M2
   * @description 验证预警数据按到期时间排序
   */
  it('should sort alerts by expiration date', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const urgentSection = screen.getByTestId('urgent-alerts-section');
    const alertItems = within(urgentSection).getAllByTestId(/alert-item-/);
    
    // 验证按到期时间升序排列
    const firstItemText = within(alertItems[0]).getByText(/服务器集群 A/).textContent;
    const secondItemText = within(alertItems[1]).getByText(/网络设备 B/).textContent;
    expect(firstItemText).toBeDefined();
    expect(secondItemText).toBeDefined();
  });

  /**
   * @testCase ADV-M3
   * @description 验证预警项显示维保类型
   */
  it('should display maintenance type in alert items', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const maintenanceType = screen.getByText(/定期保养/i);
    expect(maintenanceType).toBeInTheDocument();
  });

  /**
   * @testCase ADV-M4
   * @description 验证预警项显示资产编号
   */
  it('should display asset ID in alert items', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const assetId = screen.getByText(/AST-001/i);
    expect(assetId).toBeInTheDocument();
  });
});

/**
 * 响应式行为测试
 * @description 验证组件在不同数据量下的行为
 */
describe('Responsive Behavior Tests', () => {
  /**
   * 测试 Setup - 每个测试用例前执行
   * @description 重置计时器 mock
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * 测试 Teardown - 每个测试用例后执行
   * @description 清理计时器 mock
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testCase RSP-M1
   * @description 验证大量预警数据时正确渲染
   */
  it('should render correctly with large number of alerts', () => {
    const manyUrgentAlerts: MaintenanceAlert[] = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      assetId: `AST-${String(i + 1).padStart(3, '0')}`,
      assetName: `资产 ${i + 1}`,
      maintenanceType: '定期保养',
      expirationDate: '2024-01-20',
      daysRemaining: 5,
      alertLevel: 'urgent' as AlertLevel,
    }));
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={manyUrgentAlerts}
        warningAlerts={[]}
      />
    );

    const alertItems = screen.getAllByTestId(/alert-item-/);
    expect(alertItems).toHaveLength(50);
  });

  /**
   * @testCase RSP-M2
   * @description 验证单个预警数据时正确渲染
   */
  it('should render correctly with single alert', () => {
    const singleAlert: MaintenanceAlert[] = [
      {
        id: 1,
        assetId: 'AST-001',
        assetName: '唯一资产',
        maintenanceType: '定期保养',
        expirationDate: '2024-01-20',
        daysRemaining: 5,
        alertLevel: 'urgent' as AlertLevel,
      },
    ];
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={singleAlert}
        warningAlerts={[]}
      />
    );

    const alertItems = screen.getAllByTestId(/alert-item-/);
    expect(alertItems).toHaveLength(1);
    expect(screen.getByText('唯一资产')).toBeInTheDocument();
  });
});

/**
 * 交互状态测试
 * @description 验证组件的交互状态和反馈
 */
describe('Interaction State Tests', () => {
  /**
   * 测试 Setup - 每个测试用例前执行
   * @description 重置计时器 mock
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  /**
   * 测试 Teardown - 每个测试用例后执行
   * @description 清理计时器 mock
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @testCase INT-M1
   * @description 验证预警项悬停状态
   */
  it('should show hover state on alert items', async () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const alertItem = screen.getByTestId('alert-item-1');
    
    // 模拟悬停事件
    fireEvent.mouseEnter(alertItem);
    expect(alertItem).toHaveClass('alert-item-hover');
    
    // 模拟移出事件
    fireEvent.mouseLeave(alertItem);
    expect(alertItem).not.toHaveClass('alert-item-hover');
  });

  /**
   * @testCase INT-M2
   * @description 验证预警项焦点状态
   */
  it('should show focus state on alert items', () => {
    const mockData = createMockAlerts();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
      />
    );

    const alertItem = screen.getByTestId('alert-item-1');
    fireEvent.focus(alertItem);
    expect(alertItem).toHaveClass('alert-item-focus');
    
    fireEvent.blur(alertItem);
    expect(alertItem).not.toHaveClass('alert-item-focus');
  });

  /**
   * @testCase INT-M3
   * @description 验证键盘导航支持
   */
  it('should support keyboard navigation', () => {
    const mockData = createMockAlerts();
    const mockNavigate = vi.fn();
    
    render(
      <MaintenanceAlertCard
        urgentAlerts={mockData.urgentAlerts}
        warningAlerts={mockData.warningAlerts}
        onNavigate={mockNavigate}
      />
    );

    const alertItem = screen.getByTestId('alert-item-1');
    
    // 模拟 Enter 键
    fireEvent.keyDown(alertItem, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalled();
    
    // 模拟 Space 键
    const secondAlertItem = screen.getByTestId('alert-item-2');
    fireEvent.keyDown(secondAlertItem, { key: ' ' });
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });
});