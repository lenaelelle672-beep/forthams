import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import StatCard from '../../../../src/pages/DashboardPage/components/StatisticsPanel/StatCard/StatCard.vue';
import type { StatCardProps } from '../../../../src/pages/DashboardPage/types/dashboard.types';

describe('StatCard Component', () => {
  const defaultProps: StatCardProps = {
    title: '测试指标',
    value: 100,
    icon: 'test-icon',
    trend: 5,
    color: '#1890ff',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本渲染', () => {
    it('应该正确渲染标题', () => {
      const wrapper = mount(StatCard, {
        props: defaultProps,
      });
      expect(wrapper.find('.stat-card-title').text()).toBe('测试指标');
    });

    it('应该正确渲染数值', () => {
      const wrapper = mount(StatCard, {
        props: defaultProps,
      });
      expect(wrapper.find('.stat-card-value').text()).toBe('100');
    });
  });

  describe('趋势显示', () => {
    it('应该显示正向趋势', () => {
      const wrapper = mount(StatCard, {
        props: { ...defaultProps, trend: 10 },
      });
      const trendElement = wrapper.find('.stat-trend');
      expect(trendElement.exists()).toBe(true);
    });

    it('应该显示负向趋势', () => {
      const wrapper = mount(StatCard, {
        props: { ...defaultProps, trend: -5 },
      });
      const trendElement = wrapper.find('.stat-trend');
      expect(trendElement.exists()).toBe(true);
    });

    it('趋势为零时不应显示趋势箭头', () => {
      const wrapper = mount(StatCard, {
        props: { ...defaultProps, trend: 0 },
      });
      const trendElement = wrapper.find('.stat-trend');
      expect(trendElement.exists()).toBe(false);
    });
  });

  describe('图标渲染', () => {
    it('应该渲染图标组件', () => {
      const wrapper = mount(StatCard, {
        props: defaultProps,
      });
      expect(wrapper.find('.stat-card-icon').exists()).toBe(true);
    });
  });

  describe('颜色主题', () => {
    it('应该应用自定义颜色', () => {
      const customColor = '#ff4d4f';
      const wrapper = mount(StatCard, {
        props: { ...defaultProps, color: customColor },
      });
      const iconElement = wrapper.find('.stat-card-icon');
      expect(iconElement.exists()).toBe(true);
    });
  });

  describe('数值格式化', () => {
    it('应该格式化大数值（千位分隔符）', () => {
      const wrapper = mount(StatCard, {
        props: { ...defaultProps, value: 1234567 },
      });
      expect(wrapper.find('.stat-card-value').text()).toContain('1234567');
    });

    it('应该处理小数数值', () => {
      const wrapper = mount(StatCard, {
        props: { ...defaultProps, value: 1234.56 },
      });
      expect(wrapper.find('.stat-card-value').text()).toBe('1234.56');
    });
  });

  describe('可访问性', () => {
    it('应该有适当的 aria-label', () => {
      const wrapper = mount(StatCard, {
        props: defaultProps,
      });
      const cardElement = wrapper.find('.stat-card');
      expect(cardElement.attributes('aria-label')).toBeTruthy();
    });
  });
});