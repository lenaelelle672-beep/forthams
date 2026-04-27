<template>
  <div class="approval-page">
    <el-card class="header-card">
      <template #header>
        <div class="card-header">
          <span class="title">工单审批</span>
          <el-tag :type="statusTagType" effect="dark">{{ statusLabel }}</el-tag>
        </div>
      </template>
      
      <!-- 工单基本信息 -->
      <div class="workorder-info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="工单编号">{{ workOrderInfo.id }}</el-descriptions-item>
          <el-descriptions-item label="工单类型">{{ workOrderInfo.type }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ workOrderInfo.creator }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(workOrderInfo.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="当前处理人" :span="2">{{ workOrderInfo.handler }}</el-descriptions-item>
          <el-descriptions-item label="工单描述" :span="2">{{ workOrderInfo.description }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 审批操作区域 -->
      <div v-if="canApprove" class="approval-actions">
        <el-divider content-position="left">审批操作</el-divider>
        
        <el-form ref="approvalFormRef" :model="approvalForm" :rules="approvalRules" label-width="100px">
          <el-form-item label="审批意见" prop="comment">
            <el-input
              v-model="approvalForm.comment"
              type="textarea"
              :rows="3"
              placeholder="请输入审批意见（可选）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
          
          <el-form-item v-if="actionType === 'reject'" label="驳回原因" prop="reason">
            <el-input
              v-model="approvalForm.reason"
              type="textarea"
              :rows="3"
              placeholder="请输入驳回原因（必填，至少5个字符）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>

        <div class="action-buttons">
          <el-button 
            type="success" 
            :loading="submitting"
            :disabled="submitting"
            @click="handleApprove"
          >
            <el-icon><Check /></el-icon>
            审批通过
          </el-button>
          <el-button 
            type="danger" 
            :loading="submitting"
            :disabled="submitting"
            @click="handleReject"
          >
            <el-icon><Close /></el-icon>
            驳回
          </el-button>
        </div>
      </div>

      <!-- 无权限提示 -->
      <el-alert
        v-else-if="!isLoading && workOrderInfo.status !== 'Pending'"
        :title="statusAlertMessage"
        :type="statusAlertType"
        :closable="false"
        show-icon
      />
    </el-card>

    <!-- 审批历史时间线 -->
    <el-card class="timeline-card">
      <template #header>
        <div class="card-header">
          <span class="title">审批历史</span>
          <el-badge :value="approvalHistory.length" type="primary" />
        </div>
      </template>
      
      <div v-if="isHistoryLoading" class="timeline-loading">
        <el-skeleton :rows="5" animated />
      </div>
      
      <el-timeline v-else-if="approvalHistory.length > 0" class="approval-timeline">
        <el-timeline-item
          v-for="(item, index) in approvalHistory"
          :key="item.id"
          :timestamp="formatDate(item.createdAt)"
          :type="getTimelineItemType(item.action)"
          :hollow="index === 0"
        >
          <div class="timeline-content">
            <div class="timeline-header">
              <el-tag :type="getActionTagType(item.action)" size="small">
                {{ getActionLabel(item.action) }}
              </el-tag>
              <span class="operator-name">{{ item.operatorName }}</span>
            </div>
            <div v-if="item.comment" class="timeline-comment">
              <strong>意见：</strong>{{ item.comment }}
            </div>
            <div v-if="item.reason" class="timeline-reason">
              <strong>驳回原因：</strong>{{ item.reason }}
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
      
      <el-empty v-else description="暂无审批记录" />
    </el-card>

    <!-- 确认对话框 -->
    <el-dialog
      v-model="confirmDialogVisible"
      :title="confirmDialogTitle"
      width="400px"
      :close-on-click-modal="false"
    >
      <p>{{ confirmDialogMessage }}</p>
      <template #footer>
        <el-button @click="confirmDialogVisible = false">取消</el-button>
        <el-button 
          :type="confirmDialogType" 
          :loading="submitting"
          @click="confirmAction"
        >
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 工单审批页面组件
 * 
 * 功能：
 * - 展示工单基本信息
 * - 提供审批通过/驳回操作入口
 * - 展示审批历史时间线
 * - 审批动作触发通知消息发送
 * 
 * @module ApprovalPage
 * @requires Vue 3 Composition API
 * @requires Element Plus
 * @requires Pinia Store (approvalStore)
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { Check, Close } from '@element-plus/icons-vue';
import { useApprovalStore } from '@/stores/approvalStore';
import { useApprovalBinding } from '@/composables/useApprovalBinding';
import type { ApprovalAction, ApprovalHistoryItem, WorkOrderStatus } from '@/types/approval';

/** Props 定义 */
interface Props {
  /** 工单ID */
  workOrderId: string;
}

const props = defineProps<Props>();

/** Emits 定义 */
const emit = defineEmits<{
  /** 审批完成事件 */
  (e: 'approval-completed', data: { workOrderId: string; action: ApprovalAction }): void;
  /** 审批失败事件 */
  (e: 'approval-failed', error: Error): void;
}>();

// ==================== Store & Composables ====================

const approvalStore = useApprovalStore();
const {
  workOrder,
  isLoading: storeLoading,
  error: storeError,
  executeApprovalAction,
  getApprovalHistory,
  loadWorkOrder
} = useApprovalBinding(props.workOrderId);

// ==================== Refs ====================

/** 审批表单引用 */
const approvalFormRef = ref<FormInstance>();
/** 审批表单数据 */
const approvalForm = ref({
  comment: '',
  reason: ''
});
/** 提交状态 */
const submitting = ref(false);
/** 历史记录加载状态 */
const isHistoryLoading = ref(false);
/** 审批历史记录 */
const approvalHistory = ref<ApprovalHistoryItem[]>([]);
/** 确认对话框可见性 */
const confirmDialogVisible = ref(false);
/** 确认对话框类型 */
const confirmDialogType = ref<'success' | 'danger'>('success');
/** 确认对话框标题 */
const confirmDialogTitle = ref('');
/** 确认对话框消息 */
const confirmDialogMessage = ref('');
/** 当前操作类型 */
const actionType = ref<'approve' | 'reject' | null>(null);

// ==================== Computed ====================

/** 页面加载状态 */
const isLoading = computed(() => storeLoading.value);

/** 工单信息 */
const workOrderInfo = computed(() => {
  if (!workOrder.value) {
    return {
      id: props.workOrderId,
      type: '-',
      creator: '-',
      createdAt: '-',
      handler: '-',
      description: '-',
      status: 'Pending' as WorkOrderStatus
    };
  }
  return {
    id: workOrder.value.id,
    type: workOrder.value.type,
    creator: workOrder.value.creatorName,
    createdAt: workOrder.value.createdAt,
    handler: workOrder.value.handlerName,
    description: workOrder.value.description,
    status: workOrder.value.status
  };
});

/** 工单状态标签类型 */
const statusTagType = computed(() => {
  const statusMap: Record<WorkOrderStatus, string> = {
    'Pending': 'warning',
    'Approved': 'success',
    'Rejected': 'danger',
    'Processing': 'primary',
    'Closed': 'info'
  };
  return statusMap[workOrder.value?.status || 'Pending'] || 'info';
});

/** 工单状态标签文本 */
const statusLabel = computed(() => {
  const labelMap: Record<WorkOrderStatus, string> = {
    'Pending': '待审批',
    'Approved': '已通过',
    'Rejected': '已驳回',
    'Processing': '处理中',
    'Closed': '已关闭'
  };
  return labelMap[workOrder.value?.status || 'Pending'] || workOrder.value?.status;
});

/** 是否可以审批 */
const canApprove = computed(() => {
  return workOrder.value?.status === 'Pending' && hasApprovalPermission.value;
});

/** 是否有审批权限 */
const hasApprovalPermission = computed(() => {
  // TODO: 接入权限系统后替换为真实权限判断
  return approvalStore.hasPermission(props.workOrderId, 'approve');
});

/** 状态提示消息 */
const statusAlertMessage = computed(() => {
  if (!workOrder.value) return '';
  if (workOrder.value.status === 'Approved') {
    return '该工单已审批通过';
  } else if (workOrder.value.status === 'Rejected') {
    return '该工单已被驳回';
  }
  return '该工单当前状态不支持审批操作';
});

/** 状态提示类型 */
const statusAlertType = computed(() => {
  if (!workOrder.value) return 'info';
  if (workOrder.value.status === 'Approved') return 'success';
  if (workOrder.value.status === 'Rejected') return 'warning';
  return 'info';
});

// ==================== Form Rules ====================

/** 表单验证规则 */
const approvalRules = computed<FormRules>({
  comment: [
    { max: 500, message: '审批意见最多500个字符', trigger: 'blur' }
  ],
  reason: [
    { required: true, message: '请输入驳回原因', trigger: 'blur' },
    { min: 5, message: '驳回原因至少5个字符', trigger: 'blur' }
  ]
});

// ==================== Methods ====================

/**
 * 格式化日期
 * @param date - 日期字符串或Date对象
 * @returns 格式化后的日期字符串
 */
function formatDate(date: string | Date | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 获取时间线项目类型
 * @param action - 审批动作
 * @returns Element Plus timeline item type
 */
function getTimelineItemType(action: ApprovalAction): '' | 'success' | 'warning' | 'danger' | 'primary' | 'info' {
  const typeMap: Record<ApprovalAction, '' | 'success' | 'warning' | 'danger'> = {
    'approve': 'success',
    'reject': 'danger',
    'submit': 'primary',
    'withdraw': 'warning'
  };
  return typeMap[action] || '';
}

/**
 * 获取动作标签类型
 * @param action - 审批动作
 * @returns Element Plus tag type
 */
function getActionTagType(action: ApprovalAction): 'success' | 'danger' | 'primary' | 'warning' | 'info' {
  const typeMap: Record<ApprovalAction, 'success' | 'danger' | 'primary' | 'warning' | 'info'> = {
    'approve': 'success',
    'reject': 'danger',
    'submit': 'primary',
    'withdraw': 'warning'
  };
  return typeMap[action] || 'info';
}

/**
 * 获取动作标签文本
 * @param action - 审批动作
 * @returns 动作标签文本
 */
function getActionLabel(action: ApprovalAction): string {
  const labelMap: Record<ApprovalAction, string> = {
    'approve': '审批通过',
    'reject': '驳回',
    'submit': '提交',
    'withdraw': '撤回'
  };
  return labelMap[action] || action;
}

/**
 * 处理审批通过
 */
async function handleApprove(): Promise<void> {
  actionType.value = 'approve';
  confirmDialogType.value = 'success';
  confirmDialogTitle.value = '确认审批通过';
  confirmDialogMessage.value = '确定要通过此工单的审批吗？';
  confirmDialogVisible.value = true;
}

/**
 * 处理驳回
 */
async function handleReject(): Promise<void> {
  actionType.value = 'reject';
  confirmDialogType.value = 'danger';
  confirmDialogTitle.value = '确认驳回';
  confirmDialogMessage.value = '确定要驳回此工单吗？驳回后申请人需要重新修改提交。';
  confirmDialogVisible.value = true;
}

/**
 * 确认执行操作
 */
async function confirmAction(): Promise<void> {
  if (actionType.value === 'reject') {
    // 驳回操作需要验证表单
    const valid = await approvalFormRef.value?.validate().catch(() => false);
    if (!valid) {
      confirmDialogVisible.value = false;
      return;
    }
  }

  submitting.value = true;
  confirmDialogVisible.value = false;

  try {
    const action = actionType.value as ApprovalAction;
    const result = await executeApprovalAction(
      action,
      action === 'reject' ? approvalForm.value.reason : approvalForm.value.comment
    );

    if (result) {
      ElMessage.success(action === 'approve' ? '审批通过成功' : '驳回成功');
      
      // 发送通知
      await sendApprovalNotification(action);
      
      // 刷新历史记录
      await loadApprovalHistory();
      
      // 重置表单
      approvalForm.value = { comment: '', reason: '' };
      approvalFormRef.value?.resetFields();
      
      // 触发完成事件
      emit('approval-completed', { workOrderId: props.workOrderId, action });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    ElMessage.error(err.message || '操作失败');
    emit('approval-failed', err);
  } finally {
    submitting.value = false;
    actionType.value = null;
  }
}

/**
 * 发送审批通知
 * @param action - 审批动作
 */
async function sendApprovalNotification(action: ApprovalAction): Promise<void> {
  try {
    await approvalStore.sendNotification({
      workOrderId: props.workOrderId,
      action,
      operatorId: approvalStore.currentUserId,
      operatorName: approvalStore.currentUserName,
      timestamp: new Date().toISOString(),
      comment: action === 'approve' ? approvalForm.value.comment : approvalForm.value.reason
    });
  } catch (error) {
    console.warn('发送通知失败:', error);
    // 通知失败不影响主流程
  }
}

/**
 * 加载审批历史
 */
async function loadApprovalHistory(): Promise<void> {
  isHistoryLoading.value = true;
  try {
    const history = await getApprovalHistory(props.workOrderId);
    approvalHistory.value = history;
  } catch (error) {
    console.error('加载审批历史失败:', error);
    ElMessage.warning('加载审批历史失败');
  } finally {
    isHistoryLoading.value = false;
  }
}

// ==================== Lifecycle ====================

/**
 * 组件挂载时初始化数据
 */
onMounted(async () => {
  await loadApprovalHistory();
});

/**
 * 组件卸载时清理资源
 */
onUnmounted(() => {
  // 清理定时器等资源
  approvalStore.cleanup();
});

// ==================== Expose ====================

defineExpose({
  /** 刷新审批历史 */
  refreshHistory: loadApprovalHistory,
  /** 获取工单信息 */
  getWorkOrderInfo: () => workOrder.value
});
</script>

<style scoped lang="scss">
.approval-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header-card {
  margin-bottom: 20px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .title {
      font-size: 18px;
      font-weight: 600;
    }
  }
}

.workorder-info {
  margin-bottom: 20px;
}

.approval-actions {
  margin-top: 20px;
  
  .action-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 20px;
    
    .el-button {
      min-width: 120px;
    }
  }
}

.timeline-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .title {
      font-size: 18px;
      font-weight: 600;
    }
  }
}

.timeline-loading {
  padding: 20px;
}

.approval-timeline {
  padding: 10px 0;
  
  .timeline-content {
    .timeline-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      
      .operator-name {
        font-weight: 500;
        color: #303133;
      }
    }
    
    .timeline-comment,
    .timeline-reason {
      font-size: 14px;
      color: #606266;
      line-height: 1.6;
      margin-top: 4px;
      
      strong {
        color: #303133;
      }
    }
    
    .timeline-reason {
      color: #f56c6c;
    }
  }
}

:deep(.el-timeline-item__node--large) {
  width: 12px;
  height: 12px;
}
</style>