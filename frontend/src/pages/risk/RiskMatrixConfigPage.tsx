import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { riskApi } from '@/api/risk';
import type { RiskMatrix, MatrixDimensionItem, MatrixLevelMapping } from '@/types/risk';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const RiskMatrixConfigPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMatrix, setEditingMatrix] = useState<RiskMatrix | null>(null);
  const [formData, setFormData] = useState<Partial<RiskMatrix>>({
    matrixName: '',
    probabilityDimension: [],
    severityDimension: [],
    levelMapping: []
  });

  const queryClient = useQueryClient();

  // 获取矩阵列表
  const { data: matrixList, isLoading } = useQuery({
    queryKey: ['riskMatrixList', page],
    queryFn: () => riskApi.matrixList({ pageNum: page, pageSize: 10 })
  });

  // 创建矩阵
  const createMutation = useMutation({
    mutationFn: (data: RiskMatrix) => riskApi.matrixCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riskMatrixList'] });
      setIsDialogOpen(false);
      setFormData({
        matrixName: '',
        probabilityDimension: [],
        severityDimension: [],
        levelMapping: []
      });
    }
  });

  // 更新矩阵
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RiskMatrix }) =>
      riskApi.matrixUpdate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riskMatrixList'] });
      setIsDialogOpen(false);
      setEditingMatrix(null);
      setFormData({
        matrixName: '',
        probabilityDimension: [],
        severityDimension: [],
        levelMapping: []
      });
    }
  });

  // 删除矩阵
  const deleteMutation = useMutation({
    mutationFn: (id: number) => riskApi.matrixDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riskMatrixList'] });
    }
  });

  // 启用/禁用矩阵
  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: number }) =>
      riskApi.matrixSetActive(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riskMatrixList'] });
    }
  });

  // 打开创建对话框
  const handleOpenCreate = () => {
    setEditingMatrix(null);
    setFormData({
      matrixName: '',
      probabilityDimension: [
        { value: 1, label: '极低' },
        { value: 2, label: '较低' },
        { value: 3, label: '中等' },
        { value: 4, label: '较高' },
        { value: 5, label: '极高' }
      ],
      severityDimension: [
        { value: 1, label: '轻微' },
        { value: 2, label: '一般' },
        { value: 3, label: '严重' },
        { value: 4, label: '非常严重' },
        { value: 5, label: '灾难性' }
      ],
      levelMapping: [
        { minScore: 20, level: 'CRITICAL' },
        { minScore: 10, level: 'HIGH' },
        { minScore: 4, level: 'MEDIUM' },
        { minScore: 0, level: 'LOW' }
      ]
    });
    setIsDialogOpen(true);
  };

  // 打开编辑对话框
  const handleOpenEdit = (matrix: RiskMatrix) => {
    setEditingMatrix(matrix);
    setFormData({
      matrixName: matrix.matrixName,
      probabilityDimension: matrix.probabilityDimension,
      severityDimension: matrix.severityDimension,
      levelMapping: matrix.levelMapping,
      isActive: matrix.isActive
    });
    setIsDialogOpen(true);
  };

  // 保存
  const handleSave = () => {
    if (editingMatrix) {
      updateMutation.mutate({
        id: editingMatrix.id!,
        data: formData as RiskMatrix
      });
    } else {
      createMutation.mutate(formData as RiskMatrix);
    }
  };

  // 删除
  const handleDelete = (id: number) => {
    if (confirm('确定要删除此矩阵配置吗？')) {
      deleteMutation.mutate(id);
    }
  };

  // 切换激活状态
  const handleToggleActive = (id: number, isActive: number) => {
    setActiveMutation.mutate({
      id,
      active: isActive === 1 ? 0 : 1
    });
  };

  // 添加概率维度项
  const addProbabilityDimension = () => {
    const newDimension = [...(formData.probabilityDimension || [])];
    const maxValue = newDimension.length > 0
      ? Math.max(...newDimension.map(d => d.value))
      : 0;
    newDimension.push({ value: maxValue + 1, label: `等级 ${maxValue + 1}` });
    setFormData({ ...formData, probabilityDimension: newDimension });
  };

  // 移除概率维度项
  const removeProbabilityDimension = (index: number) => {
    const newDimension = [...(formData.probabilityDimension || [])];
    newDimension.splice(index, 1);
    setFormData({ ...formData, probabilityDimension: newDimension });
  };

  // 更新概率维度项
  const updateProbabilityDimension = (index: number, field: keyof MatrixDimensionItem, value: any) => {
    const newDimension = [...(formData.probabilityDimension || [])];
    newDimension[index] = { ...newDimension[index], [field]: value };
    setFormData({ ...formData, probabilityDimension: newDimension });
  };

  // 添加严重度维度项
  const addSeverityDimension = () => {
    const newDimension = [...(formData.severityDimension || [])];
    const maxValue = newDimension.length > 0
      ? Math.max(...newDimension.map(d => d.value))
      : 0;
    newDimension.push({ value: maxValue + 1, label: `等级 ${maxValue + 1}` });
    setFormData({ ...formData, severityDimension: newDimension });
  };

  // 移除严重度维度项
  const removeSeverityDimension = (index: number) => {
    const newDimension = [...(formData.severityDimension || [])];
    newDimension.splice(index, 1);
    setFormData({ ...formData, severityDimension: newDimension });
  };

  // 更新严重度维度项
  const updateSeverityDimension = (index: number, field: keyof MatrixDimensionItem, value: any) => {
    const newDimension = [...(formData.severityDimension || [])];
    newDimension[index] = { ...newDimension[index], [field]: value };
    setFormData({ ...formData, severityDimension: newDimension });
  };

  // 添加等级映射
  const addLevelMapping = () => {
    const newMapping = [...(formData.levelMapping || [])];
    newMapping.push({ minScore: 0, level: 'LOW' });
    setFormData({ ...formData, levelMapping: newMapping });
  };

  // 移除等级映射
  const removeLevelMapping = (index: number) => {
    const newMapping = [...(formData.levelMapping || [])];
    newMapping.splice(index, 1);
    setFormData({ ...formData, levelMapping: newMapping });
  };

  // 更新等级映射
  const updateLevelMapping = (index: number, field: keyof MatrixLevelMapping, value: any) => {
    const newMapping = [...(formData.levelMapping || [])];
    newMapping[index] = { ...newMapping[index], [field]: value };
    setFormData({ ...formData, levelMapping: newMapping });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">风险矩阵配置</h1>
          <p className="text-gray-500 mt-1">管理风险评估的概率维度、严重度维度和等级映射规则</p>
        </div>
        <Button onClick={handleOpenCreate}>创建矩阵</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>矩阵名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrixList?.records?.map((matrix: RiskMatrix) => (
                  <TableRow key={matrix.id}>
                    <TableCell className="font-medium">{matrix.matrixName}</TableCell>
                    <TableCell>
                      <Badge variant={matrix.isActive === 1 ? 'default' : 'secondary'}>
                        {matrix.isActive === 1 ? '已启用' : '已禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell>{matrix.createTime?.split('T')[0]}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(matrix)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(matrix.id!, matrix.isActive!)}
                        >
                          {matrix.isActive === 1 ? '禁用' : '启用'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(matrix.id!)}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!matrixList?.records || matrixList.records.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      暂无矩阵配置
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMatrix ? '编辑矩阵配置' : '创建矩阵配置'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="matrixName">矩阵名称</Label>
              <Input
                id="matrixName"
                value={formData.matrixName}
                onChange={(e) => setFormData({ ...formData, matrixName: e.target.value })}
                placeholder="输入矩阵名称"
              />
            </div>

            <Tabs defaultValue="probability" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="probability">概率维度</TabsTrigger>
                <TabsTrigger value="severity">严重度维度</TabsTrigger>
                <TabsTrigger value="mapping">等级映射</TabsTrigger>
              </TabsList>

              <TabsContent value="probability" className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>概率维度配置</Label>
                  <Button variant="outline" size="sm" onClick={addProbabilityDimension}>
                    添加维度
                  </Button>
                </div>
                {formData.probabilityDimension?.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      type="number"
                      value={item.value}
                      onChange={(e) => updateProbabilityDimension(index, 'value', parseInt(e.target.value))}
                      className="w-20"
                    />
                    <Input
                      value={item.label}
                      onChange={(e) => updateProbabilityDimension(index, 'label', e.target.value)}
                      placeholder="维度名称"
                      className="flex-1"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeProbabilityDimension(index)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="severity" className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>严重度维度配置</Label>
                  <Button variant="outline" size="sm" onClick={addSeverityDimension}>
                    添加维度
                  </Button>
                </div>
                {formData.severityDimension?.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      type="number"
                      value={item.value}
                      onChange={(e) => updateSeverityDimension(index, 'value', parseInt(e.target.value))}
                      className="w-20"
                    />
                    <Input
                      value={item.label}
                      onChange={(e) => updateSeverityDimension(index, 'label', e.target.value)}
                      placeholder="维度名称"
                      className="flex-1"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeSeverityDimension(index)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="mapping" className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>风险等级映射规则（按 minScore 降序排列）</Label>
                  <Button variant="outline" size="sm" onClick={addLevelMapping}>
                    添加规则
                  </Button>
                </div>
                {formData.levelMapping?.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      type="number"
                      value={item.minScore}
                      onChange={(e) => updateLevelMapping(index, 'minScore', parseInt(e.target.value))}
                      className="w-32"
                      placeholder="最低分数"
                    />
                    <Input
                      value={item.level}
                      onChange={(e) => updateLevelMapping(index, 'level', e.target.value)}
                      placeholder="风险等级 (LOW/MEDIUM/HIGH/CRITICAL)"
                      className="flex-1"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeLevelMapping(index)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              {editingMatrix ? '更新' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RiskMatrixConfigPage;