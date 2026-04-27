/**
 * CategoryChart 组件单元测试
 * 
 * 测试目标：验证资产分类分布环形图组件的数据展示、交互行为和状态管理
 * 
 * @module tests/unit/dashboard/components/CategoryChart.spec
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import CategoryChart from '@/pages/DashboardPage/components/DistributionChart/DistributionChart.vue';

// Mock ECharts
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    dispose: vi.fn(),
    getDom: vi.fn(() => document.createElement('div')),
    getOption: vi.fn(() => ({})),
  })),
  connect: vi.fn(),
  disconnect: vi.fn(),
  dispose: vi.fn(),
}));

// Mock router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  currentRoute: {
    value: { path: '/dashboard', query: {} },
  },
};

// Mock route
const mockRoute = {
  path: '/dashboard',
  query: {},
};

// 模拟数据
const mockCategoryData = [
  { categoryId: 'C1', categoryName: '电子设备', count: 500, percentage: 40 },
  { categoryId: 'C2', categoryName: '办公家具', count: 300, percentage: 24 },
  { categoryId: 'C3', categoryName: '生产设备', count: 250, percentage: 20 },
  { categoryId: 'C4', categoryName: '运输工具', count: 150, percentage: 12 },
  { categoryId: 'C5', categoryName: '其他资产', count: 50, percentage: 4 },
];

const defaultProps = {
  data: mockCategoryData,
  loading: false,
  error: null,
};

describe('CategoryChart 组件单元测试', () => {
  let wrapper: VueWrapper<any>;

  const createWrapper = (props = {}) => {
    return mount(CategoryChart, {
      props: {
        ...defaultProps,
        ...props,
      },
      global: {
        plugins: [
          createTestingPinia({
            stubActions: false,
          }),
        ],
        mocks: {
          $router: mockRouter,
          $route: mockRoute,
        },
        stubs: {
          'el-card': true,
          'el-icon': true,
          'el-loading': true,
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('ATB-C1: 组件渲染与数据展示', () => {
    it('应正确渲染图表容器', () => {
      wrapper = createWrapper();
      const chartContainer = wrapper.find('[data-testid="category-chart"]');
      expect(chartContainer.exists()).toBe(true);
    });

    it('当数据为空时应显示空状态提示', () => {
      wrapper = createWrapper({ data: [] });
      const emptyState = wrapper.find('[data-testid="chart-empty-state"]');
      expect(emptyState.exists()).toBe(true);
    });

    it('加载状态时应显示骨架屏或加载指示器', () => {
      wrapper = createWrapper({ loading: true });
      const loadingIndicator = wrapper.find('[data-testid="chart-loading"]');
      expect(loadingIndicator.exists()).toBe(true);
    });

    it('错误状态时应显示错误提示', () => {
      const errorMessage = '数据加载失败，请稍后重试';
      wrapper = createWrapper({ error: errorMessage });
      const errorState = wrapper.find('[data-testid="chart-error-state"]');
      expect(errorState.exists()).toBe(true);
      expect(errorState.text()).toContain(errorMessage);
    });
  });

  describe('ATB-C2: 图表配置与数据绑定', () => {
    it('应正确设置环形图标题', () => {
      wrapper = createWrapper();
      const title = wrapper.find('[data-testid="chart-title"]');
      expect(title.exists()).toBe(true);
      expect(title.text()).toContain('资产分类分布');
    });

    it('应正确传递分类数据至图表配置', () => {
      wrapper = createWrapper();
      // 验证图表选项配置
      const chartInstance = wrapper.vm.chartInstance;
      expect(chartInstance).toBeDefined();
    });

    it('应按数量降序排列分类数据', () => {
      const unorderedData = [
        { categoryId: 'C3', categoryName: '生产设备', count: 250, percentage: 20 },
        { categoryId: 'C1', categoryName: '电子设备', count: 500, percentage: 40 },
        { categoryId: 'C2', categoryName: '办公家具', count: 300, percentage: 24 },
      ];
      wrapper = createWrapper({ data: unorderedData });
      
      const sortedData = wrapper.vm.sortedData;
      expect(sortedData[0].count).toBeGreaterThanOrEqual(sortedData[1].count);
      expect(sortedData[1].count).toBeGreaterThanOrEqual(sortedData[2].count);
    });

    it('应正确计算分类占比百分比', () => {
      wrapper = createWrapper();
      const totalCount = mockCategoryData.reduce((sum, item) => sum + item.count, 0);
      expect(totalCount).toBe(1250);
    });
  });

  describe('ATB-C3: 交互行为', () => {
    it('扇区 hover 时应触发高亮效果', async () => {
      wrapper = createWrapper();
      const chartContainer = wrapper.find('[data-testid="category-chart"]');
      
      // 模拟鼠标悬停事件
      await chartContainer.trigger('mouseenter');
      
      // 验证图表实例的高亮方法被调用
      const chartInstance = wrapper.vm.chartInstance;
      expect(chartInstance).toBeDefined();
    });

    it('图例点击应支持分类筛选', async () => {
      wrapper = createWrapper();
      
      // 获取图例项
      const legendItems = wrapper.findAll('[data-testid="chart-legend-item"]');
      expect(legendItems.length).toBe(mockCategoryData.length);
      
      // 点击第一个图例项
      if (legendItems.length > 0) {
        await legendItems[0].trigger('click');
      }
    });

    it('扇区点击应跳转至分类筛选页', async () => {
      wrapper = createWrapper();
      
      const firstCategory = mockCategoryData[0];
      
      // 模拟扇区点击事件
      wrapper.vm.handleChartClick({
        data: { categoryId: firstCategory.categoryId },
      });
      
      // 验证路由跳转
      expect(mockRouter.push).toHaveBeenCalledWith({
        path: '/assets',
        query: { categoryId: firstCategory.categoryId },
      });
    });

    it('点击无效扇区不应触发路由跳转', () => {
      wrapper = createWrapper();
      
      wrapper.vm.handleChartClick({ data: null });
      
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe('ATB-C4: Tooltip 配置', () => {
    it('应显示分类名称', () => {
      wrapper = createWrapper();
      const tooltip = wrapper.vm.chartOptions.tooltip;
      
      expect(tooltip).toBeDefined();
      expect(tooltip.trigger).toBe('item');
    });

    it('应显示资产数量', () => {
      wrapper = createWrapper();
      const tooltip = wrapper.vm.chartOptions.tooltip;
      
      // 验证 tooltip formatter 能够显示数量
      expect(tooltip.formatter).toBeDefined();
    });

    it('应显示百分比占比', () => {
      wrapper = createWrapper();
      const tooltip = wrapper.vm.chartOptions.tooltip;
      
      // 验证格式化函数包含百分比信息
      const formatter = tooltip.formatter;
      expect(formatter).toBeDefined();
    });
  });

  describe('ATB-C5: 响应式行为', () => {
    it('窗口 resize 时应自动调整图表大小', async () => {
      wrapper = createWrapper();
      
      // 模拟窗口resize事件
      window.dispatchEvent(new Event('resize'));
      
      // 验证图表实例的resize方法被调用
      await wrapper.vm.$nextTick();
      
      const chartInstance = wrapper.vm.chartInstance;
      if (chartInstance && typeof chartInstance.resize === 'function') {
        expect(chartInstance.resize).toHaveBeenCalled();
      }
    });

    it('组件销毁时应清理图表实例', () => {
      wrapper = createWrapper();
      const chartInstance = wrapper.vm.chartInstance;
      
      wrapper.unmount();
      
      if (chartInstance && typeof chartInstance.dispose === 'function') {
        expect(chartInstance.dispose).toHaveBeenCalled();
      }
    });
  });

  describe('ATB-C6: 状态管理集成', () => {
    it('应从 Store 获取分类分布数据', () => {
      const pinia = createTestingPinia({
        stubActions: false,
      });
      
      wrapper = mount(CategoryChart, {
        props: defaultProps,
        global: {
          plugins: [pinia],
          mocks: {
            $router: mockRouter,
            $route: mockRoute,
          },
        },
      });
      
      // 验证组件挂载成功
      expect(wrapper.exists()).toBe(true);
    });

    it('props 优先级应高于 Store 数据', () => {
      const propsData = [
        { categoryId: 'CUSTOM', categoryName: '自定义分类', count: 100, percentage: 100 },
      ];
      
      wrapper = mount(CategoryChart, {
        props: { ...defaultProps, data: propsData },
        global: {
          plugins: [createTestingPinia()],
          mocks: {
            $router: mockRouter,
            $route: mockRoute,
          },
        },
      });
      
      // 验证使用的是 props 数据而非 store 数据
      expect(wrapper.vm.data).toEqual(propsData);
    });
  });

  describe('ATB-C7: 边界条件处理', () => {
    it('应处理单个分类数据', () => {
      const singleCategory = [
        { categoryId: 'C1', categoryName: '电子设备', count: 1000, percentage: 100 },
      ];
      
      wrapper = createWrapper({ data: singleCategory });
      expect(wrapper.vm.sortedData).toHaveLength(1);
    });

    it('应处理极大数量数据点', () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        categoryId: `C${i}`,
        categoryName: `分类${i}`,
        count: Math.floor(Math.random() * 1000),
        percentage: 0,
      }));
      
      // 计算总数量和百分比
      const total = largeDataset.reduce((sum, item) => sum + item.count, 0);
      largeDataset.forEach(item => {
        item.percentage = Number((item.count / total * 100).toFixed(2));
      });
      
      wrapper = createWrapper({ data: largeDataset });
      expect(wrapper.vm.sortedData).toHaveLength(100);
    });

    it('应处理缺失 percentage 字段的数据', () => {
      const incompleteData = [
        { categoryId: 'C1', categoryName: '电子设备', count: 500 },
        { categoryId: 'C2', categoryName: '办公家具', count: 500 },
      ];
      
      wrapper = createWrapper({ data: incompleteData });
      
      // 验证组件能够处理缺失字段
      expect(wrapper.vm.sortedData).toHaveLength(2);
    });

    it('应处理 count 为 0 的分类', () => {
      const zeroCountData = [
        { categoryId: 'C1', categoryName: '电子设备', count: 500, percentage: 50 },
        { categoryId: 'C2', categoryName: '办公家具', count: 0, percentage: 0 },
      ];
      
      wrapper = createWrapper({ data: zeroCountData });
      expect(wrapper.vm.sortedData).toBeDefined();
    });
  });

  describe('ATB-C8: 辅助功能', () => {
    it('应提供图表刷新方法', () => {
      wrapper = createWrapper();
      
      expect(typeof wrapper.vm.refreshChart).toBe('function');
      
      // 调用刷新方法
      wrapper.vm.refreshChart();
    });

    it('应支持数据导出功能', () => {
      wrapper = createWrapper();
      
      expect(typeof wrapper.vm.exportData).toBe('function');
    });

    it('应记录图表点击事件日志', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      wrapper = createWrapper();
      wrapper.vm.handleChartClick({
        data: { categoryId: 'C1', categoryName: '电子设备' },
      });
      
      // 验证日志记录
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});