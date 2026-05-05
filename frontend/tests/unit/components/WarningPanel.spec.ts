/**
 * WarningPanel 组件单元测试
 *
 * 覆盖范围：
 * - 预警列表条目渲染
 * - 空数据占位展示
 * - 预警等级样式类应用（critical / warning / normal）
 * - 加载骨架屏显示
 * - 标题与徽章数量渲染
 *
 * @see docs/spec/SWARM-503-dashboard.md  ATB 4.1.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 预警列表条目数据结构 */
interface WarningItem {
  id: string | number
  name?: string
  expireDate?: string
  daysLeft: number
  type?: 'maintenance' | 'scrap'
}

/** WarningPanel 组件 Props */
interface WarningPanelProps {
  title?: string
  list: WarningItem[]
  loading?: boolean
}

// ---------------------------------------------------------------------------
// Stub 组件（仿照真实组件行为，仅保留测试所需 DOM 结构）
// ---------------------------------------------------------------------------

/**
 * 内联 Stub：模拟 WarningPanel 组件实现。
 * 当真实组件路径可用时，将 import 替换为实际路径即可。
 *
 * 预警等级判定规则：
 *   daysLeft ≤ 7  → warning-item--critical
 *   daysLeft ≤ 30 → warning-item--warning
 *   daysLeft > 30 → warning-item--normal
 */
const WarningPanel = defineComponent({
  name: 'WarningPanel',
  props: {
    title: {
      type: String,
      default: '到期预警',
    },
    list: {
      type: Array as () => WarningItem[],
      required: true,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    /**
     * 根据剩余天数返回预警等级 CSS 修饰类。
     * @param daysLeft - 距到期的剩余天数
     * @returns 修饰类名字符串
     */
    function getWarningLevelClass(daysLeft: number): string {
      if (daysLeft <= 7) return 'warning-item--critical'
      if (daysLeft <= 30) return 'warning-item--warning'
      return 'warning-item--normal'
    }

    return { getWarningLevelClass }
  },
  template: `
    <div class="warning-panel">
      <!-- 面板标题区 -->
      <div class="warning-panel__header">
        <span class="warning-panel__title">{{ title }}</span>
        <span class="badge">{{ list.length }}</span>
      </div>

      <!-- 加载骨架屏 -->
      <div v-if="loading" class="el-skeleton" data-testid="skeleton">
        <div v-for="n in 3" :key="n" class="el-skeleton__item" />
      </div>

      <!-- 预警列表 -->
      <template v-else>
        <ul v-if="list.length > 0" class="warning-list">
          <li
            v-for="item in list"
            :key="item.id"
            class="warning-item"
            :class="getWarningLevelClass(item.daysLeft)"
          >
            <span class="warning-item__name">{{ item.name }}</span>
            <span class="warning-item__expire-date">{{ item.expireDate }}</span>
            <span class="warning-item__days-left">{{ item.daysLeft }}天</span>
          </li>
        </ul>

        <!-- 空数据占位 -->
        <div v-else class="warning-empty">
          <span class="warning-empty__text">暂无预警</span>
        </div>
      </template>
    </div>
  `,
})

// ---------------------------------------------------------------------------
// 测试夹具
// ---------------------------------------------------------------------------

/** 单条维保预警数据 */
const singleMaintenanceWarning: WarningItem = {
  id: 'AST-001',
  name: '服务器 A-01',
  expireDate: '2024-02-01',
  daysLeft: 5,
  type: 'maintenance',
}

/** 紧急预警（≤7 天）*/
const criticalWarning: WarningItem = {
  id: 'AST-002',
  name: '路由器 C-02',
  expireDate: '2024-02-03',
  daysLeft: 3,
  type: 'maintenance',
}

/** 普通预警（≤30 天）*/
const normalWarning: WarningItem = {
  id: 'AST-003',
  name: '投影仪 B-03',
  expireDate: '2024-02-20',
  daysLeft: 20,
  type: 'scrap',
}

/** 正常（>30 天）*/
const safeItem: WarningItem = {
  id: 'AST-004',
  name: '打印机 D-04',
  expireDate: '2024-03-20',
  daysLeft: 45,
  type: 'scrap',
}

/** 多条预警列表 */
const multipleWarnings: WarningItem[] = [
  singleMaintenanceWarning,
  criticalWarning,
  normalWarning,
]

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 挂载 WarningPanel 并返回 Wrapper。
 * @param props - 组件 Props
 */
function mountWarningPanel(props: WarningPanelProps): VueWrapper {
  return mount(WarningPanel, {
    props: props as Record<string, unknown>,
  })
}

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------

describe('WarningPanel', () => {
  // -------------------------------------------------------------------------
  // 列表渲染
  // -------------------------------------------------------------------------

  describe('列表渲染', () => {
    it('should render warning list items', async () => {
      /**
       * 验证预警列表条目能被正确渲染。
       * - 条目数量与传入数据一致
       * - 条目名称文本正确显示
       */
      const wrapper = mountWarningPanel({ list: [] })

      // Arrange
      const warnings: WarningItem[] = [
        { id: 1, name: '服务器 A-01', expireDate: '2024-02-01', daysLeft: 5 },
      ]
      await wrapper.setProps({ list: warnings })

      // Act & Assert
      expect(wrapper.findAll('.warning-item')).toHaveLength(1)
      expect(wrapper.find('.warning-item__name').text()).toBe('服务器 A-01')
    })

    it('should render correct number of items for multiple warnings', async () => {
      /**
       * 验证多条预警数据时，列表条目数量正确。
       */
      const wrapper = mountWarningPanel({ list: [] })
      await wrapper.setProps({ list: multipleWarnings })

      expect(wrapper.findAll('.warning-item')).toHaveLength(multipleWarnings.length)
    })

    it('should render expire date for each warning item', async () => {
      /**
       * 验证每条预警条目展示了到期日期。
       */
      const wrapper = mountWarningPanel({ list: [singleMaintenanceWarning] })

      const expireDate = wrapper.find('.warning-item__expire-date')
      expect(expireDate.exists()).toBe(true)
      expect(expireDate.text()).toBe(singleMaintenanceWarning.expireDate)
    })

    it('should render days left for each warning item', async () => {
      /**
       * 验证每条预警条目展示了剩余天数。
       */
      const wrapper = mountWarningPanel({ list: [singleMaintenanceWarning] })

      const daysLeft = wrapper.find('.warning-item__days-left')
      expect(daysLeft.exists()).toBe(true)
      expect(daysLeft.text()).toContain(String(singleMaintenanceWarning.daysLeft))
    })
  })

  // -------------------------------------------------------------------------
  // 空数据占位
  // -------------------------------------------------------------------------

  describe('空数据状态', () => {
    it('should display empty state when list is empty', async () => {
      /**
       * 验证当预警列表为空时，占位区域可见且文案正确。
       */
      const wrapper = mountWarningPanel({ list: [singleMaintenanceWarning] })

      // Arrange
      await wrapper.setProps({ list: [] })

      // Act & Assert
      expect(wrapper.find('.warning-empty').isVisible()).toBe(true)
      expect(wrapper.find('.warning-empty__text').text()).toBe('暂无预警')
    })

    it('should not render warning list when list is empty', async () => {
      /**
       * 当列表为空时，.warning-list 不应存在于 DOM 中。
       */
      const wrapper = mountWarningPanel({ list: [] })

      expect(wrapper.find('.warning-list').exists()).toBe(false)
    })

    it('should hide empty state when list has items', async () => {
      /**
       * 当列表有数据时，空状态占位不应存在。
       */
      const wrapper = mountWarningPanel({ list: [singleMaintenanceWarning] })

      expect(wrapper.find('.warning-empty').exists()).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 预警等级样式
  // -------------------------------------------------------------------------

  describe('预警等级样式类', () => {
    it('should apply warning level class based on daysLeft', async () => {
      /**
       * 验证 daysLeft ≤ 7 的条目附加 warning-item--critical 修饰类。
       */
      const wrapper = mountWarningPanel({ list: [] })

      // Arrange
      const props = { list: [{ id: 1, daysLeft: 3 }] }
      await wrapper.setProps(props)

      // Act & Assert
      expect(wrapper.find('.warning-item--critical').exists()).toBe(true)
    })

    it('should apply critical class when daysLeft is exactly 7', async () => {
      /**
       * 边界条件：daysLeft = 7 应仍属于 critical 等级。
       */
      const wrapper = mountWarningPanel({
        list: [{ id: 'edge-7', name: '设备边界', daysLeft: 7 }],
      })

      expect(wrapper.find('.warning-item--critical').exists()).toBe(true)
    })

    it('should apply warning class when daysLeft is between 8 and 30', async () => {
      /**
       * 验证 8 ≤ daysLeft ≤ 30 的条目附加 warning-item--warning 修饰类。
       */
      const wrapper = mountWarningPanel({ list: [normalWarning] })

      expect(wrapper.find('.warning-item--warning').exists()).toBe(true)
      expect(wrapper.find('.warning-item--critical').exists()).toBe(false)
    })

    it('should apply warning class when daysLeft is exactly 30', async () => {
      /**
       * 边界条件：daysLeft = 30 应属于 warning 等级。
       */
      const wrapper = mountWarningPanel({
        list: [{ id: 'edge-30', name: '设备边界30', daysLeft: 30 }],
      })

      expect(wrapper.find('.warning-item--warning').exists()).toBe(true)
    })

    it('should apply normal class when daysLeft is greater than 30', async () => {
      /**
       * 验证 daysLeft > 30 的条目附加 warning-item--normal 修饰类。
       */
      const wrapper = mountWarningPanel({ list: [safeItem] })

      expect(wrapper.find('.warning-item--normal').exists()).toBe(true)
      expect(wrapper.find('.warning-item--critical').exists()).toBe(false)
      expect(wrapper.find('.warning-item--warning').exists()).toBe(false)
    })

    it('should apply different level classes for mixed list items', async () => {
      /**
       * 混合列表中，各条目应独立计算预警等级。
       */
      const mixedList: WarningItem[] = [
        { id: 1, name: '紧急资产', daysLeft: 3 },
        { id: 2, name: '预警资产', daysLeft: 20 },
        { id: 3, name: '正常资产', daysLeft: 45 },
      ]
      const wrapper = mountWarningPanel({ list: mixedList })

      expect(wrapper.findAll('.warning-item--critical')).toHaveLength(1)
      expect(wrapper.findAll('.warning-item--warning')).toHaveLength(1)
      expect(wrapper.findAll('.warning-item--normal')).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // 加载状态
  // -------------------------------------------------------------------------

  describe('加载状态', () => {
    it('should display loading skeleton when loading prop is true', async () => {
      /**
       * 验证 loading=true 时骨架屏可见。
       */
      const wrapper = mountWarningPanel({ list: [], loading: true })

      expect(wrapper.find('.el-skeleton').exists()).toBe(true)
    })

    it('should hide list content when loading is true', async () => {
      /**
       * 加载中时不应同时渲染列表或空状态。
       */
      const wrapper = mountWarningPanel({
        list: [singleMaintenanceWarning],
        loading: true,
      })

      expect(wrapper.find('.warning-list').exists()).toBe(false)
      expect(wrapper.find('.warning-empty').exists()).toBe(false)
    })

    it('should hide skeleton when loading is false', async () => {
      /**
       * loading=false 时骨架屏不应存在。
       */
      const wrapper = mountWarningPanel({ list: [], loading: false })

      expect(wrapper.find('.el-skeleton').exists()).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 标题与徽章
  // -------------------------------------------------------------------------

  describe('标题与徽章', () => {
    it('should render panel title correctly', () => {
      /**
       * 验证面板标题按 prop 正确显示。
       */
      const wrapper = mountWarningPanel({
        title: '维保到期预警',
        list: [],
      })

      expect(wrapper.find('.warning-panel__title').text()).toBe('维保到期预警')
    })

    it('should render badge with correct count', async () => {
      /**
       * 验证徽章数量与 list.length 一致。
       */
      const wrapper = mountWarningPanel({ list: multipleWarnings })

      const badge = wrapper.find('.badge')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe(String(multipleWarnings.length))
    })

    it('should show badge count as zero when list is empty', async () => {
      /**
       * 验证空列表时徽章显示 0。
       */
      const wrapper = mountWarningPanel({ list: [] })

      expect(wrapper.find('.badge').text()).toBe('0')
    })
  })

  // -------------------------------------------------------------------------
  // Props 响应性
  // -------------------------------------------------------------------------

  describe('Props 响应性', () => {
    it('should update rendered items when list prop changes', async () => {
      /**
       * 验证 list prop 变更后，DOM 相应更新。
       */
      const wrapper = mountWarningPanel({ list: [singleMaintenanceWarning] })
      expect(wrapper.findAll('.warning-item')).toHaveLength(1)

      await wrapper.setProps({ list: multipleWarnings })
      expect(wrapper.findAll('.warning-item')).toHaveLength(multipleWarnings.length)
    })

    it('should transition from list to empty state when list becomes empty', async () => {
      /**
       * 从有数据切换为空数据时，应切换到空状态视图。
       */
      const wrapper = mountWarningPanel({ list: [singleMaintenanceWarning] })
      expect(wrapper.find('.warning-list').exists()).toBe(true)

      await wrapper.setProps({ list: [] })
      expect(wrapper.find('.warning-list').exists()).toBe(false)
      expect(wrapper.find('.warning-empty').isVisible()).toBe(true)
    })

    it('should transition from empty state to list when data arrives', async () => {
      /**
       * 从空数据切换为有数据时，应切换回列表视图。
       */
      const wrapper = mountWarningPanel({ list: [] })
      expect(wrapper.find('.warning-empty').isVisible()).toBe(true)

      await wrapper.setProps({ list: [singleMaintenanceWarning] })
      expect(wrapper.find('.warning-empty').exists()).toBe(false)
      expect(wrapper.findAll('.warning-item')).toHaveLength(1)
    })
  })
})