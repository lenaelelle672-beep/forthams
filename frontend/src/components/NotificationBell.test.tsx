import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationBell from './NotificationBell';

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads unread count and fetches notifications through the unified notification API', async () => {
    render(<NotificationBell userId="user-1" refreshInterval={0} />);

    await waitFor(() => expect(screen.getByTestId('unread-badge')).toHaveTextContent('1'));

    fireEvent.click(screen.getByRole('button', { name: '查看通知' }));

    expect(await screen.findByText('工单待审批')).toBeInTheDocument();
    expect(screen.getAllByText('工单已通过').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('服务器扩容申请需要您审批')).toBeInTheDocument();
  });

  it('marks a notification and all notifications as read', async () => {
    render(<NotificationBell userId="user-1" refreshInterval={0} />);

    fireEvent.click(screen.getByRole('button', { name: '查看通知' }));
    await screen.findByText('工单待审批');

    fireEvent.click(screen.getByRole('button', { name: '标记已读' }));
    await waitFor(() => {
      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    });
  });
});
