/**
 * @fileOverview Dashboard Store 单元测试
 * @module frontend/tests/unit/dashboard/store.test.ts
 * @description 验证 SWARM-003 仪表板数据看板的 Pinia Store 功能
 *              包含资产统计、分类分布、维保预警数据的获取与状态管理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDashboardStore } from '@/stores/dashboard'

// Mock HTTP 客户端
vi.mock('@/utils/http', () => ({
  httpClient: {
    get: vi.fn(),
    patch: vi.fn()
  }
}))

import { httpClient } from '@/utils/http'

describe('DashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fetchStatistics', () => {
    /**
     * @description ATB-1.1: 验证正确解析总资产数、在用数、闲置数、维保中数
     */
    it('应正确解析总资产数、在用数、闲置数、维保中数', async () => {
      const mockData = {
        total: 1250,
        inUse: 980,
        idle: 180,
        underMaintenance: 90
      }
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockData })

      const store = useDashboardStore()
      await store.fetchStatistics()

      expect(store.statistics).toEqual(mockData)
      expect(store.statistics?.total).toBe(1250)
      expect(store.statistics?.inUse).toBe(980)
      expect(store.statistics?.idle).toBe(180)
      expect(store.statistics?.underMaintenance).toBe(90)
    })

    /**
     * @description ATB-1.2: 验证 API 失败时应抛出异常且不污染状态
     */
    it('API 失败时应抛出异常且不污染状态', async () => {
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network Error'))

      const store = useDashboardStore()
      await expect(store.fetchStatistics()).rejects.toThrow('Network Error')
      expect(store.statistics).toBeNull()
    })

    /**
     * @description ATB-1.3: 验证加载状态正确切换
     */
    it('加载过程中应设置 loading 状态', async () => {
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: { total: 100 } }), 100))
      )

      const store = useDashboardStore()
      const fetchPromise = store.fetchStatistics()

      expect(store.loading).toBe(true)

      await fetchPromise
      expect(store.loading).toBe(false)
    })
  })

  describe('fetchCategoryDistribution', () => {
    /**
     * @description ATB-1.4: 验证返回按数量降序排列的分类列表
     */
    it('应返回按数量降序排列的分类列表', async () => {
      const mockData = [
        { categoryId: 'C1', categoryName: '电子设备', count: 500 },
        { categoryId: 'C2', categoryName: '办公家具', count: 300 }
      ]
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockData })

      const store = useDashboardStore()
      await store.fetchCategoryDistribution()

      expect(store.categories).toHaveLength(2)
      expect(store.categories[0].count).toBeGreaterThanOrEqual(store.categories[1].count)
    })

    /**
     * @description ATB-1.5: 验证空数据返回空数组
     */
    it('无分类数据时应返回空数组', async () => {
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })

      const store = useDashboardStore()
      await store.fetchCategoryDistribution()

      expect(store.categories).toEqual([])
    })
  })

  describe('fetchMaintenanceAlerts', () => {
    /**
     * @description ATB-1.6: 验证过滤仅返回未来90天内到期项
     */
    it('应过滤仅返回未来90天内到期项', async () => {
      const today = new Date()
      const mockData = [
        { assetId: 'A1', assetName: '资产A', dueDate: new Date(today.getTime() + 5 * 86400000).toISOString() }, // 5天后
        { assetId: 'A2', assetName: '资产B', dueDate: new Date(today.getTime() + 100 * 86400000).toISOString() } // 100天后 - 应被过滤
      ]
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockData })

      const store = useDashboardStore()
      await store.fetchMaintenanceAlerts()

      expect(store.alerts).toHaveLength(1)
      expect(store.alerts[0].assetId).toBe('A1')
    })

    /**
     * @description ATB-1.7: 验证维保预警按紧急程度排序
     */
    it('应按紧急程度降序排列（紧急项优先）', async () => {
      const today = new Date()
      const mockData = [
        { assetId: 'A3', assetName: '资产C', dueDate: new Date(today.getTime() + 3 * 86400000).toISOString() }, // 3天后 - 最紧急
        { assetId: 'A1', assetName: '资产A', dueDate: new Date(today.getTime() + 5 * 86400000).toISOString() }, // 5天后
        { assetId: 'A2', assetName: '资产B', dueDate: new Date(today.getTime() + 25 * 86400000).toISOString() } // 25天后
      ]
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockData })

      const store = useDashboardStore()
      await store.fetchMaintenanceAlerts()

      expect(store.alerts).toHaveLength(3)
      expect(store.alerts[0].assetId).toBe('A3') // 最近到期优先
    })

    /**
     * @description ATB-1.8: 验证最多显示5条预警
     */
    it('超过5条预警时应截断为5条', async () => {
      const today = new Date()
      const mockData = Array.from({ length: 10 }, (_, i) => ({
        assetId: `A${i}`,
        assetName: `资产${i}`,
        dueDate: new Date(today.getTime() + (i + 1) * 86400000).toISOString()
      }))
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockData })

      const store = useDashboardStore()
      await store.fetchMaintenanceAlerts()

      expect(store.alerts.length).toBeLessThanOrEqual(5)
    })
  })

  describe('markMaintenanceHandled', () => {
    /**
     * @description ATB-1.9: 验证标记处理功能更新 UI 状态
     */
    it('标记处理后应从预警列表移除该资产', async () => {
      const today = new Date()
      const mockAlerts = [
        { assetId: 'A1', assetName: '资产A', dueDate: new Date(today.getTime() + 5 * 86400000).toISOString() },
        { assetId: 'A2', assetName: '资产B', dueDate: new Date(today.getTime() + 10 * 86400000).toISOString() }
      ]
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockAlerts })
      ;(httpClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true } })

      const store = useDashboardStore()
      await store.fetchMaintenanceAlerts()

      expect(store.alerts).toHaveLength(2)

      await store.markMaintenanceHandled('A1')

      expect(store.alerts).toHaveLength(1)
      expect(store.alerts[0].assetId).toBe('A2')
    })

    /**
     * @description ATB-1.10: 验证标记处理 API 失败时的错误处理
     */
    it('API 失败时不应移除预警项', async () => {
      const today = new Date()
      const mockAlerts = [
        { assetId: 'A1', assetName: '资产A', dueDate: new Date(today.getTime() + 5 * 86400000).toISOString() }
      ]
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockAlerts })
      ;(httpClient.patch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Update Failed'))

      const store = useDashboardStore()
      await store.fetchMaintenanceAlerts()

      await expect(store.markMaintenanceHandled('A1')).rejects.toThrow('Update Failed')
      expect(store.alerts).toHaveLength(1) // 保持原状
    })
  })

  describe('refreshDashboard', () => {
    /**
     * @description ATB-1.11: 验证刷新功能同时获取所有数据
     */
    it('refreshDashboard 应同时获取统计数据、分类和预警', async () => {
      ;(httpClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} })

      const store = useDashboardStore()
      await store.refreshDashboard()

      // 验证调用了三个数据接口
      expect(httpClient.get).toHaveBeenCalledTimes(3)
    })
  })
})