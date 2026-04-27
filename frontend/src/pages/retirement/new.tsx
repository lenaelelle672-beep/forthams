/**
 * 资产报废/退役新建申请页面
 * 
 * @description 支持用户发起资产报废请求的表单页面
 *              实现状态: DRAFT → SUBMITTED 状态流转
 * 
 * @spec SWARM-002 资产报废/退役流程
 * @since 1.0.0
 * 
 * @features
 * - 报废资产选择（支持按状态过滤）
 * - 报废理由输入（最多500字符）
 * - 高价值资产（>50000）标记增强审批
 * - 状态初始为 DRAFT，提交后进入 SUBMITTED
 * 
 * @constraints
 * - SC-002: 单次请求最多关联资产数量 ≤ 10
 * - HC-001: 报废请求提交后不可直接进入 DISPOSED 状态
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/approval/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Plus, Trash2, Info, CheckCircle2 } from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

/** 资产价值等级 */
export type AssetValueTier = 'LOW' | 'MEDIUM' | 'HIGH';

/** 资产状态 */
export type AssetStatusType = 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';

/** 报废请求状态 */
export type RetirementStatus = 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL_L1' | 'PENDING_APPROVAL_L2' | 'PENDING_APPROVAL_L3' | 'APPROVED' | 'REJECTED' | 'DISPOSED';

/** 报废资产项 */
export interface RetirementAssetItem {
  assetId: string;
  assetName: string;
  assetValue: number;
  valueTier: AssetValueTier;
  status: AssetStatusType;
}

/** 报废请求表单数据 */
export interface RetirementRequestForm {
  assets: RetirementAssetItem[];
  reason: string;
  notes?: string;
}

/** 提交后的报废请求响应 */
export interface RetirementRequestResponse {
  requestId: string;
  status: RetirementStatus;
  assets: RetirementAssetItem[];
  reason: string;
  requesterId: string;
  createdAt: string;
  approvalTier: AssetValueTier;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 报废理由最大字符数 - ATB-006-01 */
const MAX_REASON_LENGTH = 500;

/** 高价值资产阈值 - ATB-003-07 */
const HIGH_VALUE_THRESHOLD = 50000;

/** 中等价值资产阈值 */
const MEDIUM_VALUE_THRESHOLD = 10000;

/** 单次请求最大资产数量 - SC-002 */
const MAX_ASSETS_COUNT = 10;

/** 状态流转映射 - 核心状态机 */
const STATUS_TRANSITIONS: Record<RetirementStatus, RetirementStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['PENDING_APPROVAL_L1'],
  PENDING_APPROVAL_L1: ['PENDING_APPROVAL_L2', 'REJECTED'],
  PENDING_APPROVAL_L2: ['PENDING_APPROVAL_L3', 'REJECTED'],
  PENDING_APPROVAL_L3: ['APPROVED', 'REJECTED'],
  APPROVED: ['DISPOSED'],
  REJECTED: [],
  DISPOSED: [],
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 计算资产价值等级
 * @param value - 资产价值
 * @returns 价值等级
 */
function calculateValueTier(value: number): AssetValueTier {
  if (value > HIGH_VALUE_THRESHOLD) return 'HIGH';
  if (value >= MEDIUM_VALUE_THRESHOLD) return 'MEDIUM';
  return 'LOW';
}

/**
 * 验证报废请求是否可以提交
 * @param form - 表单数据
 * @returns 验证结果
 */
function validateRetirementRequest(form: RetirementRequestForm): { valid: boolean; error?: string } {
  // 检查资产数量 - SC-002
  if (form.assets.length === 0) {
    return { valid: false, error: '请至少选择一个要报废的资产' };
  }
  if (form.assets.length > MAX_ASSETS_COUNT) {
    return { valid: false, error: `单次请求最多关联 ${MAX_ASSETS_COUNT} 个资产` };
  }

  // 检查报废理由
  if (!form.reason.trim()) {
    return { valid: false, error: '请输入报废理由' };
  }
  if (form.reason.length > MAX_REASON_LENGTH) {
    return { valid: false, error: `报废理由不能超过 ${MAX_REASON_LENGTH} 字符` };
  }

  // 检查资产状态 - ATB-001-04
  const retiredAssets = form.assets.filter(a => a.status === 'RETIRED');
  if (retiredAssets.length > 0) {
    return { 
      valid: false, 
      error: `资产 "${retiredAssets[0].assetName}" 已处于退役状态，无法重复提交` 
    };
  }

  // 检查是否有重复资产
  const assetIds = form.assets.map(a => a.assetId);
  const uniqueIds = new Set(assetIds);
  if (uniqueIds.size !== assetIds.length) {
    return { valid: false, error: '不能选择重复的资产' };
  }

  return { valid: true };
}

/**
 * 获取整体审批等级（取最高等级）
 * @param assets - 资产列表
 * @returns 审批等级
 */
function getApprovalTier(assets: RetirementAssetItem[]): AssetValueTier {
  const tiers = assets.map(a => a.valueTier);
  if (tiers.includes('HIGH')) return 'HIGH';
  if (tiers.includes('MEDIUM')) return 'MEDIUM';
  return 'LOW';
}

/**
 * 模拟获取可用资产列表
 * @returns 资产列表
 */
async function fetchAvailableAssets(): Promise<RetirementAssetItem[]> {
  // 实际应调用 API: GET /assets?status=ACTIVE,MAINTENANCE
  return [
    { assetId: 'AST-001', assetName: 'Dell PowerEdge R740 服务器', assetValue: 45000, valueTier: 'MEDIUM', status: 'ACTIVE' },
    { assetId: 'AST-002', assetName: 'Cisco Catalyst 9300 交换机', assetValue: 28000, valueTier: 'MEDIUM', status: 'ACTIVE' },
    { assetId: 'AST-003', assetName: 'HP ProLiant DL380 服务器', assetValue: 65000, valueTier: 'HIGH', status: 'MAINTENANCE' },
    { assetId: 'AST-004', assetName: '联想 ThinkPad T490 笔记本', assetValue: 8500, valueTier: 'LOW', status: 'ACTIVE' },
    { assetId: 'AST-005', assetName: 'Samsung 55寸 4K 显示器', assetValue: 3200, valueTier: 'LOW', status: 'ACTIVE' },
    { assetId: 'AST-006', assetName: 'Epson WorkForce Pro 打印机', assetValue: 2800, valueTier: 'LOW', status: 'MAINTENANCE' },
    { assetId: 'AST-007', assetName: 'Oracle 数据库一体机', assetValue: 180000, valueTier: 'HIGH', status: 'ACTIVE' },
  ];
}

/**
 * 提交报废请求
 * @param form - 表单数据
 * @returns 请求响应
 */
async function submitRetirementRequest(form: RetirementRequestForm): Promise<RetirementRequestResponse> {
  // 实际应调用 API: POST /retirements
  // 模拟 API 调用
  return new Promise((resolve) => {
    setTimeout(() => {
      const response: RetirementRequestResponse = {
        requestId: `RET-${Date.now()}`,
        status: 'DRAFT', // 初始状态
        assets: form.assets,
        reason: form.reason,
        requesterId: 'USR-001',
        createdAt: new Date().toISOString(),
        approvalTier: getApprovalTier(form.assets),
      };
      resolve(response);
    }, 500);
  });
}

/**
 * 执行状态流转
 * @param currentStatus - 当前状态
 * @param action - 流转动作
 * @returns 下一状态
 */
function executeTransition(currentStatus: RetirementStatus, action: string): RetirementStatus | null {
  const validNextStates = STATUS_TRANSITIONS[currentStatus];
  if (!validNextStates || validNextStates.length === 0) {
    return null;
  }

  // 根据动作确定下一状态
  switch (action) {
    case 'SUBMIT':
      return 'SUBMITTED';
    case 'APPROVE_L1':
      return 'PENDING_APPROVAL_L1';
    case 'APPROVE_L2':
      return 'PENDING_APPROVAL_L2';
    case 'APPROVE_L3':
      return 'PENDING_APPROVAL_L3';
    case 'APPROVE':
      return 'APPROVED';
    case 'REJECT':
      return 'REJECTED';
    case 'DISPOSE':
      return 'DISPOSED';
    default:
      return null;
  }
}

// ============================================================================
// 组件定义
// ============================================================================

/**
 * 资产报废新建申请页面组件
 */
export function RetirementNewPage() {
  const navigate = useNavigate();

  // 表单状态
  const [form, setForm] = useState<RetirementRequestForm>({
    assets: [],
    reason: '',
    notes: '',
  });

  // 可选资产列表
  const [availableAssets, setAvailableAssets] = useState<RetirementAssetItem[]>([]);
  
  // 加载状态
  const [loading, setLoading] = useState(false);
  const [fetchingAssets, setFetchingAssets] = useState(true);
  
  // 错误和成功消息
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 当前状态
  const [currentStatus, setCurrentStatus] = useState<RetirementStatus>('DRAFT');

  // 加载可用资产列表
  useEffect(() => {
    async function loadAssets() {
      setFetchingAssets(true);
      try {
        const assets = await fetchAvailableAssets();
        setAvailableAssets(assets);
      } catch (err) {
        setError('加载资产列表失败，请重试');
      } finally {
        setFetchingAssets(false);
      }
    }
    loadAssets();
  }, []);

  // 处理添加资产
  const handleAddAsset = useCallback((asset: RetirementAssetItem) => {
    setForm(prev => {
      if (prev.assets.length >= MAX_ASSETS_COUNT) {
        setError(`单次请求最多关联 ${MAX_ASSETS_COUNT} 个资产`);
        return prev;
      }
      if (prev.assets.some(a => a.assetId === asset.assetId)) {
        setError('该资产已在列表中');
        return prev;
      }
      if (asset.status === 'RETIRED') {
        setError(`资产 "${asset.assetName}" 已处于退役状态，无法添加`);
        return prev;
      }
      setError(null);
      return { ...prev, assets: [...prev.assets, asset] };
    });
  }, []);

  // 处理移除资产
  const handleRemoveAsset = useCallback((assetId: string) => {
    setForm(prev => ({
      ...prev,
      assets: prev.assets.filter(a => a.assetId !== assetId),
    }));
    setError(null);
  }, []);

  // 处理报废理由变更
  const handleReasonChange = useCallback((value: string) => {
    // ATB-006-01: 超长理由文本处理
    const truncatedValue = value.slice(0, MAX_REASON_LENGTH);
    setForm(prev => ({ ...prev, reason: truncatedValue }));
    setError(null);
  }, []);

  // 处理备注变更
  const handleNotesChange = useCallback((value: string) => {
    setForm(prev => ({ ...prev, notes: value }));
  }, []);

  // 提交报废请求
  const handleSubmit = async () => {
    // 验证请求
    const validation = validateRetirementRequest(form);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. 提交报废请求 - ATB-001-01
      const response = await submitRetirementRequest(form);
      
      // 2. 执行状态流转: DRAFT → SUBMITTED - ATB-002-01
      const nextStatus = executeTransition(response.status, 'SUBMIT');
      if (nextStatus) {
        setCurrentStatus(nextStatus);
        response.status = nextStatus;
      }

      // 3. 如果包含高价值资产，触发增强审批提示 - ATB-003-07
      if (response.approvalTier === 'HIGH') {
        setSuccess(`报废请求已提交（ID: ${response.requestId}）。由于包含高价值资产（>${HIGH_VALUE_THRESHOLD}），将触发增强审批流程。`);
      } else {
        setSuccess(`报废请求已提交（ID: ${response.requestId}），当前状态: ${nextStatus}`);
      }

      // 4. 延迟跳转到详情页
      setTimeout(() => {
        navigate(`/retirement/${response.requestId}`);
      }, 2000);
    } catch (err) {
      setError('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 计算当前审批等级
  const approvalTier = getApprovalTier(form.assets);

  // 剩余字符数
  const remainingChars = MAX_REASON_LENGTH - form.reason.length;

  // 资产数量提示
  const assetCountMessage = form.assets.length === 0 
    ? '请选择要报废的资产' 
    : `已选择 ${form.assets.length} 个资产${form.assets.length >= MAX_ASSETS_COUNT ? '（已达上限）' : `（剩余 ${MAX_ASSETS_COUNT - form.assets.length} 个名额）`}`;

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* 页面标题 */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/retirement')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">新建报废申请</h1>
          <p className="text-sm text-muted-foreground">
            提交资产报废请求，进入审批流程
          </p>
        </div>
      </div>

      {/* 状态指示器 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusBadge status={currentStatus} />
              <div>
                <p className="text-sm font-medium">当前状态</p>
                <p className="text-xs text-muted-foreground">
                  {currentStatus === 'DRAFT' && '草稿状态，可编辑'}
                  {currentStatus === 'SUBMITTED' && '已提交，等待 L1 审批'}
                </p>
              </div>
            </div>
            {approvalTier === 'HIGH' && (
              <div className="flex items-center gap-2 text-amber-600">
                <Info className="h-4 w-4" />
                <span className="text-sm font-medium">高价值资产 - 增强审批</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 成功提示 */}
      {success && (
        <Alert className="mb-6 border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {/* 资产选择区域 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>选择报废资产</span>
            <span className="text-sm font-normal text-muted-foreground">
              {assetCountMessage}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 已选资产列表 */}
          {form.assets.length > 0 && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium mb-2 block">已选择的资产</Label>
              <div className="space-y-2">
                {form.assets.map(asset => (
                  <div 
                    key={asset.assetId}
                    className="flex items-center justify-between p-2 bg-background rounded border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{asset.assetName}</span>
                        <StatusBadge status={asset.status} />
                        {asset.valueTier === 'HIGH' && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                            高价值 ¥{asset.assetValue.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ID: {asset.assetId} | 价值: ¥{asset.assetValue.toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAsset(asset.assetId)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 可选资产列表 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">可选资产</Label>
            {fetchingAssets ? (
              <div className="text-center py-8 text-muted-foreground">
                加载中...
              </div>
            ) : availableAssets.filter(a => !form.assets.some(fa => fa.assetId === a.assetId)).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                没有可用的资产
              </div>
            ) : (
              <div className="grid gap-2">
                {availableAssets
                  .filter(a => !form.assets.some(fa => fa.assetId === a.assetId))
                  .map(asset => (
                    <div 
                      key={asset.assetId}
                      className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{asset.assetName}</span>
                          <StatusBadge status={asset.status} />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span>ID: {asset.assetId}</span>
                          <span>价值: ¥{asset.assetValue.toLocaleString()}</span>
                          <span className={`
                            ${asset.valueTier === 'HIGH' ? 'text-amber-600' : ''}
                            ${asset.valueTier === 'MEDIUM' ? 'text-blue-600' : ''}
                          `}>
                            {asset.valueTier === 'HIGH' && '⚠️ 高价值'}
                            {asset.valueTier === 'MEDIUM' && '中等价值'}
                            {asset.valueTier === 'LOW' && '低价值'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddAsset(asset)}
                        disabled={form.assets.length >= MAX_ASSETS_COUNT || loading}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        添加
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 报废理由区域 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">报废理由</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason" className="required">
                报废原因 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={form.reason}
                onChange={(e) => handleReasonChange(e.target.value)}
                placeholder="请详细说明资产报废的原因..."
                rows={4}
                className="mt-1"
                disabled={loading}
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  请详细描述报废原因，以便审批人员评估
                </p>
                <p className={`text-xs ${remainingChars < 50 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {remainingChars} / {MAX_REASON_LENGTH}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">补充说明</Label>
              <Textarea
                id="notes"
                value={form.notes || ''}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="可选：补充任何其他相关信息..."
                rows={2}
                className="mt-1"
                disabled={loading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 提交按钮 */}
      <div className="flex items-center justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => navigate('/retirement')}
          disabled={loading}
        >
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || form.assets.length === 0 || !form.reason.trim()}
        >
          {loading ? '提交中...' : '提交报废申请'}
        </Button>
      </div>

      {/* 流程说明 */}
      <Card className="mt-6 bg-muted/30">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-3">报废流程说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                1
              </div>
              <div>
                <p className="font-medium">提交申请</p>
                <p className="text-muted-foreground">填写报废理由并提交申请</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                2
              </div>
              <div>
                <p className="font-medium">多级审批</p>
                <p className="text-muted-foreground">L1 → L2 → L3 三级审批</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                3
              </div>
              <div>
                <p className="font-medium">执行退役</p>
                <p className="text-muted-foreground">审批通过后执行资产退役</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RetirementNewPage;