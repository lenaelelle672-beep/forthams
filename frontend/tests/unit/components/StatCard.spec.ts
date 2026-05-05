import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatCard from '@/components/StatCard/index.vue'

/**
 * StatCard Component Unit Tests
 * 
 * This test suite verifies the StatCard component functionality per SWARM-503
 * dashboard requirements, covering:
 * - Title and value rendering
 * - Number formatting with thousand separator
 * - Loading state with skeleton
 * - Trend indicator display
 * - Icon rendering
 */
describe('StatCard', () => {
  describe('Basic Rendering', () => {
    /**
     * AC-003: Verify title is rendered correctly
     * Verifies that the stat card displays the provided title prop
     */
    it('should render title and value correctly', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '资产总数',
          value: 1234,
          icon: 'Box'
        }
      })
      
      expect(wrapper.find('.stat-card__title').text()).toBe('资产总数')
      expect(wrapper.find('.stat-card__value').text()).toBe('1,234')
    })

    /**
     * AC-002: Verify number formatting with thousand separator
     * Tests that large numbers are properly formatted with commas
     */
    it('should format number with thousand separator', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '资产总数',
          value: 10000
        }
      })
      
      expect(wrapper.find('.stat-card__value').text()).toBe('10,000')
    })

    /**
     * AC-003: Verify various number formats
     * Tests edge cases for number formatting
     */
    it('should handle zero value correctly', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '新增资产',
          value: 0
        }
      })
      
      expect(wrapper.find('.stat-card__value').text()).toBe('0')
    })

    it('should handle large numbers with multiple separators', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '累计资产',
          value: 1234567
        }
      })
      
      expect(wrapper.find('.stat-card__value').text()).toBe('1,234,567')
    })
  })

  describe('Loading State', () => {
    /**
     * AC-003: Verify loading skeleton is displayed when loading prop is true
     * Tests that the component shows a loading skeleton during data fetching
     */
    it('should display loading skeleton when loading prop is true', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '资产总数',
          loading: true
        }
      })
      
      expect(wrapper.find('.el-skeleton').exists()).toBe(true)
    })

    /**
     * AC-003: Verify skeleton is hidden when not loading
     * Ensures no skeleton appears in normal state
     */
    it('should not display skeleton when loading is false', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '资产总数',
          value: 500,
          loading: false
        }
      })
      
      expect(wrapper.find('.el-skeleton').exists()).toBe(false)
    })

    /**
     * AC-003: Verify default loading state is false
     * Tests that loading defaults to false when not specified
     */
    it('should default loading to false when not specified', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '资产总数',
          value: 100
        }
      })
      
      expect(wrapper.find('.el-skeleton').exists()).toBe(false)
    })
  })

  describe('Trend Indicator', () => {
    /**
     * AC-003: Verify trend indicator displays correctly when provided
     * Tests that the up/down trend arrow and value are rendered
     */
    it('should display trend with up arrow when isUp is true', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '本月新增',
          value: 45,
          trend: {
            value: 12,
            isUp: true
          }
        }
      })
      
      expect(wrapper.find('.stat-card__trend').exists()).toBe(true)
      expect(wrapper.find('.stat-card__trend--up').exists()).toBe(true)
    })

    /**
     * AC-003: Verify down trend indicator
     * Tests that the down arrow is displayed for negative trends
     */
    it('should display trend with down arrow when isUp is false', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '本月新增',
          value: 45,
          trend: {
            value: 8,
            isUp: false
          }
        }
      })
      
      expect(wrapper.find('.stat-card__trend--down').exists()).toBe(true)
    })

    /**
     * AC-003: Verify no trend indicator when trend prop is not provided
     * Tests that the trend section is hidden when no trend data
     */
    it('should not display trend when trend prop is not provided', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '资产总数',
          value: 100
        }
      })
      
      expect(wrapper.find('.stat-card__trend').exists()).toBe(false)
    })
  })

  describe('Icon Rendering', () => {
    /**
     * AC-003: Verify icon is displayed when icon prop is provided
     * Tests that the icon component renders correctly
     */
    it('should display icon when icon prop is provided', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '资产总数',
          value: 500,
          icon: 'Box'
        }
      })
      
      expect(wrapper.find('.stat-card__icon').exists()).toBe(true)
    })

    /**
     * AC-003: Verify icon container is hidden when no icon prop
     * Ensures icon area doesn't take up space without an icon
     */
    it('should not display icon container when icon prop is not provided', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '资产总数',
          value: 500
        }
      })
      
      expect(wrapper.find('.stat-card__icon').exists()).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    /**
     * AC-002: Verify component handles negative values
     * Tests that negative numbers are formatted correctly
     */
    it('should handle negative values', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '资产变化',
          value: -500
        }
      })
      
      expect(wrapper.find('.stat-card__value').text()).toBe('-500')
    })

    /**
     * AC-002: Verify component handles decimal values
     * Tests that decimal numbers are handled appropriately
     */
    it('should handle decimal values with rounding', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '平均价值',
          value: 1234.56
        }
      })
      
      expect(wrapper.find('.stat-card__value').text()).toBe('1,234.56')
    })

    /**
     * AC-003: Verify empty title handling
     * Tests graceful handling of empty title strings
     */
    it('should handle empty title string', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '',
          value: 100
        }
      })
      
      expect(wrapper.find('.stat-card__title').text()).toBe('')
    })
  })

  describe('Accessibility', () => {
    /**
     * AC-003: Verify proper aria labels for screen readers
     * Tests that the component provides accessible labels
     */
    it('should have proper aria-label for the card', () => {
      const wrapper = mount(StatCard, {
        props: {
          title: '资产总数',
          value: 500
        }
      })
      
      expect(wrapper.find('[aria-label]').exists()).toBe(true)
    })
  })
})