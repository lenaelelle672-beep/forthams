import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationBell from './NotificationBell';

vi.mock('@/api/notification', () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}));

import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '@/api/notification';

const mockedGetNotifications = vi.mocked(getNotifications);
const mockedGetUnreadCount = vi.mocked(getUnreadCount);
const mockedMarkAllAsRead = vi.mocked(markAllAsRead);
const mockedMarkAsRead = vi.mocked(markAsRead);

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetUnreadCount.mockResolvedValue(2);
    mockedGetNotifications.mockResolvedValue({
      records: [
        {
          id: 7,
          type: 'system_alert',
          category: 'SYSTEM',
          title: '系统通知',
          content: '请查看最新提醒',
          isRead: false,
          createTime: '2026-06-09T08:00:00',
        },
      ],
      total: 99,
      size: 20,
      current: 1,
      pages: 1,
    });
    mockedMarkAsRead.mockResolvedValue(undefined);
    mockedMarkAllAsRead.mockResolvedValue(undefined);
  });

  it('loads unread count and fetches notifications through the unified notification API', async () => {
    render(<NotificationBell refreshInterval={0} />);

    await waitFor(() => expect(mockedGetUnreadCount).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('unread-badge')).toHaveTextContent('2');

    fireEvent.click(screen.getByRole('button', { name: '查看通知' }));

    await waitFor(() => expect(mockedGetNotifications).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    }));
    expect(await screen.findByText('请查看最新提醒')).toBeInTheDocument();
    expect(screen.getAllByText('系统通知')).toHaveLength(2);
    expect(screen.getByTestId('unread-badge')).toHaveTextContent('2');
  });

  it('marks a notification and all notifications as read', async () => {
    render(<NotificationBell refreshInterval={0} />);

    fireEvent.click(screen.getByRole('button', { name: '查看通知' }));
    await screen.findByText('请查看最新提醒');

    fireEvent.click(screen.getByRole('button', { name: '标记已读' }));
    await waitFor(() => expect(mockedMarkAsRead).toHaveBeenCalledWith(7));

    mockedGetNotifications.mockResolvedValueOnce({
      records: [
        {
          id: 8,
          type: 'system_alert',
          title: '另一条通知',
          content: '仍未读',
          isRead: false,
          createTime: '2026-06-09T08:01:00',
        },
      ],
      total: 1,
      size: 20,
      current: 1,
      pages: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: '查看通知' }));
    fireEvent.click(screen.getByRole('button', { name: '查看通知' }));
    await screen.findByText('另一条通知');

    fireEvent.click(screen.getByRole('button', { name: '全部已读' }));
    await waitFor(() => expect(mockedMarkAllAsRead).toHaveBeenCalledTimes(1));
  });
});
