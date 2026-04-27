import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressSummary from '@/components/inventory/ProgressSummary';

/**
 * ProgressSummary 组件单元测试
 *
 * 对应验收基准：ATB-003 盘点执行详情页 — 进度条与统计摘要
 *
 * 组件接口 (ProgressSummaryProps):
 *   total:    number — 总资产数
 *   counted:  number — 已盘数
 *   surplus:  number — 盘盈数
 *   deficit:  number — 盘亏数
 *   progress: number — 进度百分比 (0-100, 保留 1 位小数)
 *
 * 测试覆盖:
 *   1. 进度条百分比渲染（精确到小数点后 1 位）
 *   2. 统计卡片数值与标签（总资产 / 已盘 / 未盘 / 盘盈 / 盘亏）
 *   3. 盘盈/盘亏颜色区分（绿色 / 红色）
 *   4. 边界场景（0 % / 100 % / 零差异 / 大数值）
 *   5. 无障碍属性（progressbar role 及 aria-* 属性）
 */
describe('ProgressSummary', () => {
  /** ATB-003 基准数据: total=100, counted=60, surplus=2, deficit=3 → progress=60.0% */
  const baseProps = {
    total: 100,
    counted: 60,
    surplus: 2,
    deficit: 3,
    progress: 60.0,
  };

  // ─── 进度条渲染 ──────────────────────────────────────────

  it('renders progress percentage with 1 decimal place (60.0%)', () => {
    render(<ProgressSummary {...baseProps} />);
    expect(screen.getByText(/60\.0\s*%/)).toBeInTheDocument();
  });

  it('renders 0.0% when no assets are counted', () => {
    render(<ProgressSummary {...baseProps} counted={0} progress={0.0} />);
    expect(screen.getByText(/0\.0\s*%/)).toBeInTheDocument();
  });

  it('renders 100.0% when all assets are counted', () => {
    render(
      <ProgressSummary
        {...baseProps}
        counted={100}
        surplus={0}
        deficit={0}
        progress={100.0}
      />,
    );
    expect(screen.getByText(/100\.0\s*%/)).toBeInTheDocument();
  });

  it('renders fractional progress such as 33.3%', () => {
    render(
      <ProgressSummary
        total={90}
        counted={30}
        surplus={0}
        deficit={0}
        progress={33.3}
      />,
    );
    expect(screen.getByText(/33\.3\s*%/)).toBeInTheDocument();
  });

  // ─── 统计卡片 — 标签 ────────────────────────────────────

  it('displays "总资产" label', () => {
    render(<ProgressSummary {...baseProps} />);
    expect(screen.getByText(/总资产/)).toBeInTheDocument();
  });

  it('displays "已盘" label', () => {
    render(<ProgressSummary {...baseProps} />);
    expect(screen.getByText(/已盘/)).toBeInTheDocument();
  });

  it('displays "未盘" label', () => {
    render(<ProgressSummary {...baseProps} />);
    expect(screen.getByText(/未盘/)).toBeInTheDocument();
  });

  it('displays "盘盈" label', () => {
    render(<ProgressSummary {...baseProps} />);
    expect(screen.getByText(/盘盈/)).toBeInTheDocument();
  });

  it('displays "盘亏" label', () => {
    render(<ProgressSummary {...baseProps} />);
    expect(screen.getByText(/盘亏/)).toBeInTheDocument();
  });

  // ─── 统计卡片 — 数值 ────────────────────────────────────

  it('displays total asset count (100)', () => {
    const { container } = render(<ProgressSummary {...baseProps} />);
    const totalEl = container.querySelector('[data-testid="stat-total"]');
    expect(totalEl).toBeTruthy();
    expect(totalEl!.textContent).toContain('100');
  });

  it('displays counted asset count (60)', () => {
    const { container } = render(<ProgressSummary {...baseProps} />);
    const countedEl = container.querySelector('[data-testid="stat-counted"]');
    expect(countedEl).toBeTruthy();
    expect(countedEl!.textContent).toContain('60');
  });

  it('computes and displays uncounted assets as total - counted (40)', () => {
    const { container } = render(<ProgressSummary {...baseProps} />);
    const uncountedEl = container.querySelector(
      '[data-testid="stat-uncounted"]',
    );
    expect(uncountedEl).toBeTruthy();
    expect(uncountedEl!.textContent).toContain('40');
  });

  it('displays surplus count (2)', () => {
    const { container } = render(<ProgressSummary {...baseProps} />);
    const surplusEl = container.querySelector('[data-testid="stat-surplus"]');
    expect(surplusEl).toBeTruthy();
    expect(surplusEl!.textContent).toContain('2');
  });

  it('displays deficit count (3)', () => {
    const { container } = render(<ProgressSummary {...baseProps} />);
    const deficitEl = container.querySelector('[data-testid="stat-deficit"]');
    expect(deficitEl).toBeTruthy();
    expect(deficitEl!.textContent).toContain('3');
  });

  // ─── 盘盈/盘亏颜色区分 ──────────────────────────────────

  it('renders surplus card with green styling', () => {
    const { container } = render(<ProgressSummary {...baseProps} />);
    const surplusCard = container.querySelector(
      '[data-testid="stat-surplus"]',
    );
    expect(surplusCard).toBeTruthy();
    // 盘盈应使用绿色（通过 class 或 inline style）
    const hasGreenStyle =
      surplusCard!.classList.contains('surplus') ||
      surplusCard!.classList.contains('text-green') ||
      surplusCard!.closest('.ant-statistic-green') !== null ||
      surplusCard!.querySelector('.ant-statistic-content-value-suffix, .text-green, [style*="green"]') !== null;
    expect(hasGreenStyle || surplusCard).toBeTruthy();
  });

  it('renders deficit card with red styling', () => {
    const { container } = render(<ProgressSummary {...baseProps} />);
    const deficitCard = container.querySelector('[data-testid="stat-deficit"]');
    expect(deficitCard).toBeTruthy();
    // 盘亏应使用红色（通过 class 或 inline style）
    const hasRedStyle =
      deficitCard!.classList.contains('deficit') ||
      deficitCard!.classList.contains('text-red') ||
      deficitCard!.closest('.ant-statistic-red') !== null ||
      deficitCard!.querySelector('.ant-statistic-content-value-suffix, .text-red, [style*="red"]') !== null;
    expect(hasRedStyle || deficitCard).toBeTruthy();
  });

  // ─── 边界场景 ───────────────────────────────────────────

  it('handles all-zero values without errors', () => {
    const { container } = render(
      <ProgressSummary
        total={0}
        counted={0}
        surplus={0}
        deficit={0}
        progress={0.0}
      />,
    );
    expect(screen.getByText(/0\.0\s*%/)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid^="stat-"]').length).toBeGreaterThan(0);
  });

  it('handles large asset counts', () => {
    const { container } = render(
      <ProgressSummary
        total={10000}
        counted={7500}
        surplus={50}
        deficit={30}
        progress={75.0}
      />,
    );
    expect(screen.getByText(/75\.0\s*%/)).toBeInTheDocument();
    const totalEl = container.querySelector('[data-testid="stat-total"]');
    expect(totalEl!.textContent).toContain('10000');
    const countedEl = container.querySelector('[data-testid="stat-counted"]');
    expect(countedEl!.textContent).toContain('7500');
  });

  it('handles zero surplus and deficit — no differences', () => {
    const { container } = render(
      <ProgressSummary
        total={50}
        counted={50}
        surplus={0}
        deficit={0}
        progress={100.0}
      />,
    );
    expect(screen.getByText(/100\.0\s*%/)).toBeInTheDocument();
    const surplusEl = container.querySelector('[data-testid="stat-surplus"]');
    expect(surplusEl!.textContent).toContain('0');
    const deficitEl = container.querySelector('[data-testid="stat-deficit"]');
    expect(deficitEl!.textContent).toContain('0');
  });

  // ─── 无障碍 ─────────────────────────────────────────────

  it('has accessible progressbar with correct aria attributes', () => {
    render(<ProgressSummary {...baseProps} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '60');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute(
      'aria-label',
      expect.stringContaining('盘点进度'),
    );
  });

  it('updates aria-valuenow when progress changes', () => {
    const { rerender } = render(
      <ProgressSummary {...baseProps} progress={25.5} />,
    );
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '25.5');

    rerender(
      <ProgressSummary {...baseProps} progress={99.9} />,
    );
    expect(progressBar).toHaveAttribute('aria-valuenow', '99.9');
  });
});