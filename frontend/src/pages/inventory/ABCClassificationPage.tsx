/**
 * @file pages/inventory/ABCClassificationPage.tsx
 * @description ABC 分类管理页面
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { abcClassificationApi, type ClassificationStatistics, type BatchResult } from '@/api/abcClassification';
import { getAssetList } from '@/api/asset';
import type { Asset } from '@/types/asset';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/Dialog';
import { Table } from 'antd';
import { Modal } from 'antd';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const ABCClassificationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [reclassifyDialogOpen, setReclassifyDialogOpen] = useState(false);

  // 查询统计数据
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['abcStatistics'],
    queryFn: abcClassificationApi.getStatistics,
  });

  // 查询资产列表
  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => getAssetList({ pageNum: 1, pageSize: 1000 }).then(res => res.records || res.list || []),
  });

  // 批量重新分类 mutation
  const reclassifyMutation = useMutation({
    mutationFn: abcClassificationApi.reclassifyAll,
    onSuccess: (result: BatchResult) => {
      toast.success(`批量重新分类完成：成功 ${result.success} 条，失败 ${result.failure} 条`);
      queryClient.invalidateQueries({ queryKey: ['abcStatistics'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setReclassifyDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`批量重新分类失败：${error.message}`);
    },
  });

  // 处理批量重新分类
  const handleReclassify = () => {
    reclassifyMutation.mutate();
  };

  // 导出 Excel 报告
  const handleExport = () => {
    if (!assets || !stats) {
      toast.error('数据未加载完成');
      return;
    }

    // 准备统计数据
    const statsData = [
      ['分类', '数量', '总价值'],
      ['A 类', stats.A_count, stats.A_total_value?.toFixed(2) || 0],
      ['B 类', stats.B_count, stats.B_total_value?.toFixed(2) || 0],
      ['C 类', stats.C_count, stats.C_total_value?.toFixed(2) || 0],
      ['CATEGORY 类', stats.CATEGORY_count, stats.CATEGORY_total_value?.toFixed(2) || 0],
      ['总计', stats.A_count + stats.B_count + stats.C_count + stats.CATEGORY_count, stats.total_value?.toFixed(2) || 0],
    ];

    // 准备资产列表数据
    const assetData = assets.map(asset => [
      asset.assetNo,
      asset.assetName,
      asset.abcClassification || '未分类',
      asset.originalValue?.toFixed(2) || 0,
      asset.categoryName || '-',
    ]);

    // 创建工作簿
    const wb = XLSX.utils.book_new();

    // 添加统计工作表
    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, statsSheet, '统计');

    // 添加资产列表工作表
    const assetHeader = [['资产编号', '资产名称', 'ABC 分类', '原值', '分类']];
    const assetSheet = XLSX.utils.aoa_to_sheet([...assetHeader, ...assetData]);
    XLSX.utils.book_append_sheet(wb, assetSheet, '资产列表');

    // 下载文件
    XLSX.writeFile(wb, `ABC分类报告_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('报告导出成功');
  };

  // ABC 分类颜色映射（Ant Design Tag 颜色）
  const classificationColors: Record<string, string> = {
    A: 'red',
    B: 'blue',
    C: 'green',
    CATEGORY: 'default',
  };

  const classificationLabels: Record<string, string> = {
    A: 'A 类（高价值）',
    B: 'B 类（中价值）',
    C: 'C 类（低价值）',
    CATEGORY: '未分类',
  };

  if (statsLoading || assetsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'assetNo',
      key: 'assetNo',
    },
    {
      title: '资产名称',
      dataIndex: 'assetName',
      key: 'assetName',
    },
    {
      title: '分类',
      dataIndex: 'categoryName',
      key: 'categoryName',
      render: (text: string) => text || '-',
    },
    {
      title: 'ABC 分类',
      dataIndex: 'abcClassification',
      key: 'abcClassification',
      render: (cls: string) => (
        <Badge variant={classificationColors[cls || 'CATEGORY']}>
          {classificationLabels[cls || 'CATEGORY']}
        </Badge>
      ),
    },
    {
      title: '原值',
      dataIndex: 'originalValue',
      key: 'originalValue',
      render: (val: number) => `¥${val?.toFixed(2) || '0.00'}`,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 标题栏 */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ABC 分类管理</h1>
        <div className="space-x-2">
          <Button variant="outline" onClick={handleExport}>
            导出报告
          </Button>
          <Button onClick={() => setReclassifyDialogOpen(true)} loading={reclassifyMutation.isPending}>
            批量重新分类
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">A 类资产</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.A_count || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              总价值：¥{stats?.A_total_value?.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">B 类资产</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.B_count || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              总价值：¥{stats?.B_total_value?.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">C 类资产</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.C_count || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              总价值：¥{stats?.C_total_value?.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-500">未分类资产</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.CATEGORY_count || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              总价值：¥{stats?.CATEGORY_total_value?.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 说明文字 */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-600">
            <strong>ABC 分类规则：</strong>根据资产原值和分类规则自动分类。
            A 类（高价值）需月度盘点，B 类（中价值）需季度盘点，C 类（低价值）需年度盘点。
            未匹配任何规则的资产标记为 CATEGORY（未分类）。
          </p>
        </CardContent>
      </Card>

      {/* 资产列表 */}
      <Card>
        <CardHeader>
          <CardTitle>资产列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            dataSource={assets || []}
            rowKey="id"
            pagination={{ pageSize: 20 }}
          />
        </CardContent>
      </Card>

      {/* 批量重新分类确认对话框 */}
      <Modal
        title="确认批量重新分类"
        open={reclassifyDialogOpen}
        onOk={handleReclassify}
        onCancel={() => setReclassifyDialogOpen(false)}
        confirmLoading={reclassifyMutation.isPending}
      >
        <p>
          此操作将根据当前的循环盘点规则重新分类所有资产。
          操作可能需要较长时间，请确认是否继续？
        </p>
      </Modal>
    </div>
  );
};

export default ABCClassificationPage;