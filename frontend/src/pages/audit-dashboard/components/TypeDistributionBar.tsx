import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, Spin, Button, Empty, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import http from '@/services/http';

/** 操作类型分布数据项 */
interface TypeDistributionItem {
  type: string;
  count: number;
}

/** 后端 by-type 接口返回结构 */
interface TypeDistributionResponse {
  categories: TypeDistributionItem[];
}

/** 组件属性 */
interface TypeDistributionBarProps {
  /** 全局时间范围，变更时自动刷新数据 */
  dateRange?: { start: string; end: string } | null;
}

/** 不同操作类型使用的柱体颜色调色板 */
const COLOR_PALETTE = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
  '#48b8d0',
];

/**
 * 操作类型分布柱状图组件
 *
 * 以 ECharts 垂直柱状图（type: 'bar'）呈现不同操作类型的数量分布，
 * 柱体使用不同颜色区分类型，支持空数据占位与错误重试。
 *
 * 对应验收测试：ATB-03
 */
const TypeDistributionBar: React.FC<TypeDistributionBarProps> = ({ dateRange }) => {
  const [data, setData] = useState<TypeDistributionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  /**
   * 从后端获取操作类型分布数据
   * 调用 GET /api/audit-logs/stats/by-type，参数含当前全局时间范围
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params: Record<string, string> = {};
      if (dateRange?.start) {
        params.start = dateRange.start;
      }
      if (dateRange?.end) {
        params.end = dateRange.end;
      }

      const response = await http.get<TypeDistributionResponse>(
        '/api/audit-logs/stats/by-type',
        { params },
      );
      setData(response.data.categories ?? []);
    } catch (err) {
      console.error('Failed to fetch type distribution:', err);
      message.error('获取操作类型分布数据失败');
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  /** 全局时间范围变更时重新请求数据 */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * 构建 ECharts 柱状图配置
   * X 轴为操作类型名称，Y 轴为操作次数
   * 每根柱体使用渐变色区分类型
   */
  const chartOption = useMemo(() => {
    if (data.length === 0) {
      return {};
    }

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any) => {
          const item = Array.isArray(params) ? params[0] : params;
          return `${item.name}: <b>${item.value}</b> 次操作`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: data.map((item) => item.type),
        axisTick: { alignWithLabel: true },
        axisLabel: {
          interval: 0,
          rotate: data.length > 6 ? 30 : 0,
        },
      },
      yAxis: {
        type: 'value' as const,
        name: '操作次数',
        splitLine: { lineStyle: { type: 'dashed' as const } },
      },
      series: [
        {
          name: '操作次数',
          type: 'bar' as const,
          barWidth: '60%',
          data: data.map((item, index) => ({
            value: item.count,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: COLOR_PALETTE[index % COLOR_PALETTE.length],
                },
                {
                  offset: 1,
                  color: `${COLOR_PALETTE[index % COLOR_PALETTE.length]}66`,
                },
              ]),
            },
          })),
          label: {
            show: true,
            position: 'top' as const,
            formatter: '{c}',
          },
        },
      ],
      animationDuration: 1000,
    };
  }, [data]);

  /** 渲染加载态 */
  const renderLoading = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: 350,
      }}
    >
      <Spin size="large" />
    </div>
  );

  /** 渲染错误态：显示错误提示 + 重试按钮 */
  const renderError = () => (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <Empty description="数据加载失败" />
      <Button type="primary" onClick={fetchData} style={{ marginTop: 16 }}>
        重试
      </Button>
    </div>
  );

  /** 渲染空数据占位 */
  const renderEmpty = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: 350,
      }}
    >
      <Empty description="暂无数据" />
    </div>
  );

  /** 渲染图表主体 */
  const renderChart = () => (
    <ReactECharts
      option={chartOption}
      style={{ height: 350, width: '100%' }}
      notMerge={true}
      lazyUpdate={true}
    />
  );

  const renderContent = () => {
    if (loading) return renderLoading();
    if (error) return renderError();
    if (data.length === 0) return renderEmpty();
    return renderChart();
  };

  return (
    <div data-testid="type-distribution-chart">
      <Card
        title="操作类型分布"
        style={{ height: '100%', minHeight: 450 }}
      >
        {renderContent()}
      </Card>
    </div>
  );
};

export default TypeDistributionBar;