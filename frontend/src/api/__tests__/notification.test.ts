import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '@/api/notification';

const mockedHttp = {
  get: vi.mocked(http.get),
  post: vi.mocked(http.post),
  put: vi.mocked(http.put),
  delete: vi.mocked(http.delete),
};

describe('api/notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses unified notification paths and relies on the shared http unwrapping contract', async () => {
    const params = { page: 1, pageSize: 10, category: 'SYSTEM', isRead: false };

    mockedHttp.get.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue(undefined);
    mockedHttp.delete.mockResolvedValue(undefined);

    await getNotifications(params);
    await getUnreadCount();
    await markAsRead(9);
    await markAllAsRead();
    await deleteNotification(9);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/notifications', { params });
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/notifications/unread-count');
    expect(mockedHttp.put).toHaveBeenNthCalledWith(1, '/notifications/9/read');
    expect(mockedHttp.put).toHaveBeenNthCalledWith(2, '/notifications/read-all');
    expect(mockedHttp.delete).toHaveBeenCalledWith('/notifications/9');
  });
});
