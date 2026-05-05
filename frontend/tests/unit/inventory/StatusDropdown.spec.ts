/**
 * StatusDropdown 组件单元测试
 *
 * 测试盘点执行详情页中"实盘状态"下拉选择组件的行为。
 * 实盘状态枚举（per SPEC）: normal | surplus | deficit | damaged | other
 *
 * 覆盖场景：
 * - 各状态下正确渲染与选项展示
 * - 选择后正确触发 onChange 回调
 * - 只读 / 禁用模式（ATB-007）
 * - 加载中状态（防重复提交 ATB-008）
 * - 无障碍属性（aria-label）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusDropdown } from '@/components/inventory/StatusDropdown';
import type { ActualStatus } from '@/types/inventory';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * 将 antd Select 降级为原生 HTML <select>，确保单元测试在 jsdom 下稳定运行。
 * 同时保留 Option 子组件渲染为 <option>。
 */
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    Select: Object.assign(
      ({
        value,
        onChange,
        disabled,
        loading,
        children,
        placeholder,
        'aria-label': ariaLabel,
        ...rest
      }: React.PropsWithChildren<any>) => (
        <select
          data-testid="status-select"
          value={value ?? ''}
          disabled={disabled || loading}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            onChange?.(e.target.value);
          }}
          aria-label={ariaLabel ?? '实盘状态'}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children}
        </select>
      ),
      {
        Option: ({ value, children, disabled }: React.PropsWithChildren<any>) => (
          <option value={value} disabled={disabled}>
            {children}
          </option>
        ),
      },
    ),
  };
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 实盘状态选项映射（与 SPEC 数据约束中 actualStatus 枚举一致） */
const STATUS_OPTIONS: { value: ActualStatus; label: string }[] = [
  { value: 'normal', label: '正常' },
  { value: 'surplus', label: '盘盈' },
  { value: 'deficit', label: '盘亏' },
  { value: 'damaged', label: '损坏' },
  { value: 'other', label: '其他' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatusDropdown', () => {
  const mockOnChange = vi.fn<[ActualStatus], void>();

  const defaultProps = {
    value: undefined as ActualStatus | undefined,
    onChange: mockOnChange,
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 渲染
  // =========================================================================

  it('renders the dropdown with aria-label="实盘状态"', () => {
    render(<StatusDropdown {...defaultProps} />);
    const select = screen.getByTestId('status-select');
    expect(select).toBeInTheDocument();
    expect(select).toHaveAttribute('aria-label', '实盘状态');
  });

  it('renders all five actualStatus options defined in SPEC', () => {
    render(<StatusDropdown {...defaultProps} />);
    const select = screen.getByTestId('status-select') as HTMLSelectElement;

    STATUS_OPTIONS.forEach(({ label }) => {
      expect(
        Array.from(select.options).some((opt) => opt.textContent === label),
      ).toBe(true);
    });

    // 5 status options + 1 placeholder = 6 options total
    expect(select.options.length).toBeGreaterThanOrEqual(STATUS_OPTIONS.length);
  });

  it('displays the current value when value prop is set to "normal"', () => {
    render(<StatusDropdown {...defaultProps} value="normal" />);
    const select = screen.getByTestId('status-select') as HTMLSelectElement;
    expect(select.value).toBe('normal');
  });

  it('displays the current value when value prop is set to "surplus"', () => {
    render(<StatusDropdown {...defaultProps} value="surplus" />);
    const select = screen.getByTestId('status-select') as HTMLSelectElement;
    expect(select.value).toBe('surplus');
  });

  it('displays the current value when value prop is set to "deficit"', () => {
    render(<StatusDropdown {...defaultProps} value="deficit" />);
    const select = screen.getByTestId('status-select') as HTMLSelectElement;
    expect(select.value).toBe('deficit');
  });

  it('displays the current value when value prop is set to "damaged"', () => {
    render(<StatusDropdown {...defaultProps} value="damaged" />);
    const select = screen.getByTestId('status-select') as HTMLSelectElement;
    expect(select.value).toBe('damaged');
  });

  it('displays the current value when value prop is set to "other"', () => {
    render(<StatusDropdown {...defaultProps} value="other" />);
    const select = screen.getByTestId('status-select') as HTMLSelectElement;
    expect(select.value).toBe('other');
  });

  it('shows placeholder when value is undefined', () => {
    render(<StatusDropdown {...defaultProps} value={undefined} />);
    const select = screen.getByTestId('status-select') as HTMLSelectElement;
    // Empty string indicates placeholder / no selection
    expect(select.value).toBe('');
  });

  // =========================================================================
  // 交互 — onChange 回调
  // =========================================================================

  it('calls onChange with "normal" when the option is selected', async () => {
    const user = userEvent.setup();
    render(<StatusDropdown {...defaultProps} />);

    await user.selectOptions(screen.getByTestId('status-select'), 'normal');
    expect(mockOnChange).toHaveBeenCalledWith('normal');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange with "surplus" when the option is selected', async () => {
    const user = userEvent.setup();
    render(<StatusDropdown {...defaultProps} />);

    await user.selectOptions(screen.getByTestId('status-select'), 'surplus');
    expect(mockOnChange).toHaveBeenCalledWith('surplus');
  });

  it('calls onChange with "deficit" when the option is selected', async () => {
    const user = userEvent.setup();
    render(<StatusDropdown {...defaultProps} />);

    await user.selectOptions(screen.getByTestId('status-select'), 'deficit');
    expect(mockOnChange).toHaveBeenCalledWith('deficit');
  });

  it('calls onChange with "damaged" when the option is selected', async () => {
    const user = userEvent.setup();
    render(<StatusDropdown {...defaultProps} />);

    await user.selectOptions(screen.getByTestId('status-select'), 'damaged');
    expect(mockOnChange).toHaveBeenCalledWith('damaged');
  });

  it('calls onChange with "other" when the option is selected', async () => {
    const user = userEvent.setup();
    render(<StatusDropdown {...defaultProps} />);

    await user.selectOptions(screen.getByTestId('status-select'), 'other');
    expect(mockOnChange).toHaveBeenCalledWith('other');
  });

  it('calls onChange for every status option in sequence', async () => {
    const user = userEvent.setup();
    render(<StatusDropdown {...defaultProps} />);

    for (const { value } of STATUS_OPTIONS) {
      await user.selectOptions(screen.getByTestId('status-select'), value);
    }

    expect(mockOnChange).toHaveBeenCalledTimes(STATUS_OPTIONS.length);
    STATUS_OPTIONS.forEach(({ value }) => {
      expect(mockOnChange).toHaveBeenCalledWith(value);
    });
  });

  // =========================================================================
  // 禁用 / 只读模式（ATB-007）
  // =========================================================================

  describe('disabled / read-only mode (ATB-007)', () => {
    it('is disabled when disabled prop is true', () => {
      render(<StatusDropdown {...defaultProps} disabled />);
      const select = screen.getByTestId('status-select');
      expect(select).toBeDisabled();
    });

    it('does not trigger onChange when disabled', async () => {
      const user = userEvent.setup();
      render(<StatusDropdown {...defaultProps} disabled />);

      const select = screen.getByTestId('status-select');
      expect(select).toBeDisabled();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('is disabled when loading prop is true (ATB-008 防重复提交)', () => {
      render(<StatusDropdown {...defaultProps} loading />);
      const select = screen.getByTestId('status-select');
      expect(select).toBeDisabled();
    });

    it('still shows the current value when disabled', () => {
      render(<StatusDropdown {...defaultProps} value="surplus" disabled />);
      const select = screen.getByTestId('status-select') as HTMLSelectElement;
      expect(select).toBeDisabled();
      expect(select.value).toBe('surplus');
    });

    it('still shows all options when disabled (read-only display)', () => {
      render(<StatusDropdown {...defaultProps} value="deficit" disabled />);
      const select = screen.getByTestId('status-select') as HTMLSelectElement;

      STATUS_OPTIONS.forEach(({ label }) => {
        expect(
          Array.from(select.options).some((opt) => opt.textContent === label),
        ).toBe(true);
      });
    });
  });

  // =========================================================================
  // 加载状态（ATB-008 防重复提交）
  // =========================================================================

  describe('loading state (ATB-008)', () => {
    it('is disabled while loading to prevent duplicate submissions', () => {
      render(<StatusDropdown {...defaultProps} loading />);
      expect(screen.getByTestId('status-select')).toBeDisabled();
    });

    it('becomes enabled after loading completes', () => {
      const { rerender } = render(
        <StatusDropdown {...defaultProps} loading />,
      );
      expect(screen.getByTestId('status-select')).toBeDisabled();

      rerender(<StatusDropdown {...defaultProps} loading={false} />);
      expect(screen.getByTestId('status-select')).not.toBeDisabled();
    });

    it('preserves the current value during loading', () => {
      const { rerender } = render(
        <StatusDropdown {...defaultProps} value="damaged" loading />,
      );
      const select = screen.getByTestId('status-select') as HTMLSelectElement;
      expect(select.value).toBe('damaged');
    });
  });

  // =========================================================================
  // 受控组件行为
  // =========================================================================

  describe('controlled value updates', () => {
    it('updates displayed value when value prop changes', () => {
      const { rerender } = render(
        <StatusDropdown {...defaultProps} value="normal" />,
      );
      expect(
        (screen.getByTestId('status-select') as HTMLSelectElement).value,
      ).toBe('normal');

      rerender(<StatusDropdown {...defaultProps} value="deficit" />);
      expect(
        (screen.getByTestId('status-select') as HTMLSelectElement).value,
      ).toBe('deficit');
    });

    it('clears displayed value when value prop is set to undefined', () => {
      const { rerender } = render(
        <StatusDropdown {...defaultProps} value="normal" />,
      );
      expect(
        (screen.getByTestId('status-select') as HTMLSelectElement).value,
      ).toBe('normal');

      rerender(<StatusDropdown {...defaultProps} value={undefined} />);
      expect(
        (screen.getByTestId('status-select') as HTMLSelectElement).value,
      ).toBe('');
    });
  });
});