import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MaintenanceAlertCard } from '@/pages/DashboardPage/components/MaintenanceAlertCard/MaintenanceAlertCard';

/**
 * Test suite for MaintenanceAlertCard component.
 * Verifies that maintenance alerts are displayed correctly with proper data formatting.
 */
describe('MaintenanceAlertCard', () => {
  const mockAlerts = [
    {
      id: '1',
      assetName: 'Test Asset 1',
      maintenanceType: '定期保养',
      dueDate: '2024-01-15',
      daysUntilDue: 3,
    },
    {
      id: '2',
      assetName: 'Test Asset 2',
      maintenanceType: '设备检修',
      dueDate: '2024-01-10',
      daysUntilDue: -2,
    },
  ];

  /**
   * Helper function to render component with mock alerts.
   * @param alerts - Array of maintenance alert data to display
   * @returns Rendered component wrapper
   */
  const renderWithAlerts = (alerts = mockAlerts) => {
    return render(<MaintenanceAlertCard alerts={alerts} />);
  };

  it('renders alert card with title', () => {
    renderWithAlerts();
    expect(screen.getByText('维保到期预警')).toBeInTheDocument();
  });

  it('displays upcoming maintenance alerts', () => {
    renderWithAlerts();
    expect(screen.getByText('Test Asset 1')).toBeInTheDocument();
    expect(screen.getByText('定期保养')).toBeInTheDocument();
  });

  it('shows overdue warnings for past due items', () => {
    renderWithAlerts();
    const overdueText = screen.getByText(/已逾期/);
    expect(overdueText).toBeInTheDocument();
  });

  it('handles empty alerts array', () => {
    renderWithAlerts([]);
    expect(screen.getByText('暂无维保预警')).toBeInTheDocument();
  });
});