<template>
  <div class="approval-container">
    <!-- 审批操作按钮区域 -->
    <div v-if="showActions" class="approval-actions">
      <el-button 
        type="success" 
        :loading="approving"
        :disabled="!canApprove"
        @click="handleApprove"
      >
        <el-icon v-if="!approving"><Check /></el-icon>
        审批通过
      </el-button>
      
      <el-button 
        type="danger" 
        :loading="rejecting"
        :disabled="!canReject"
        @click="showRejectDialog = true"
      >
        <el-icon v-if="!rejecting"><Close /></el-icon>
        驳回
      </el-button>
    </div>

    <!-- 审批通过对话框 -->
    <el-dialog
      v-model="showApproveDialog"
      title="审批通过确认"
      width="500px"
      @close="resetApproveForm"
    >
      <el-form :model="approveForm" label-width="100px">
        <el-form-item label="审批意见">
          <el-input
            v-model="approveForm.comment"
            type="textarea"
            :rows="3"
            :maxlength="500"
            show-word-limit
            placeholder="请输入审批意见（可选）"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showApproveDialog = false">取消</el-button>
        <el-button type="success" @click="confirmApprove" :loading="approving">
          确认
        </el-button>
      </template>
    </el-dialog>

    <!-- 驳回对话框 -->
    <el-dialog
      v-model="showRejectDialog"
      title="驳回工单"
      width="500px"
      @close="resetRejectForm"
    >
      <el-form :model="rejectForm" :rules="rejectRules" ref="rejectFormRef" label-width="100px">
        <el-form-item label="驳回原因" prop="reason">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="4"
            :maxlength="500"
            show-word-limit
            placeholder="请输入驳回原因（必填，至少5个字符）"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showRejectDialog = false">取消</el-button>
        <el-button type="danger" @click="confirmReject" :loading="rejecting">
          确认驳回
        </el-button>
      </template>
    </el-dialog>

    <!-- 审批历史时间线 -->
    <div v-if="showTimeline" class="approval-timeline">
      <div class="timeline-header">
        <h4>审批历史</h4>
        <span class="timeline-count">{{ historyList.length }} 条记录</span>
      </div>
      
      <el-timeline v-if="historyList.length > 0">
        <el-timeline-item
          v-for="(item, index) in historyList"
          :key="item.id || index"
          :type="getTimelineItemType(item.action)"
          :hollow="index === historyList.length - 1"
          placement="top"
        >
          <div class="timeline-item-content">
            <div class="timeline-item-header">
              <span class="timeline-action" :class="`action-${item.action}`">
                {{ getActionText(item.action) }}
              </span>
              <span class="timeline-time">{{ formatTime(item.created_at) }}</span>
            </div>
            
            <div class="timeline-item-body">
              <div class="timeline-operator">
                <el-icon><User /></el-icon>
                <span>{{ item.operator_name || item.operator_id }}</span>
              </div>
              
              <div v-if="item.comment" class="timeline-comment">
                <el-icon><ChatLineSquare /></el-icon>
                <span>{{ item.comment }}</span>
              </div>
              
              <div v-if="item.reason" class="timeline-reason">
                <el-icon><Warning /></el-icon>
                <span>驳回原因：{{ item.reason }}</span>
              </div>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
      
      <el-empty v-else description="暂无审批记录" />
      
      <!-- 加载更多 -->
      <div v-if="hasMore" class="timeline-load-more">
        <el-button link @click="loadMoreHistory" :loading="loadingMore">
          加载更多
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 工单审批操作组件
 * 
 * 提供审批通过、驳回操作入口，以及审批历史时间线展示功能。
 * 
 * @example
 * ```vue
 * <ApprovalButtons
 *   :work-order-id="workOrderId"
 *   :current-status="currentStatus"
 *   :current-handler="currentHandler"
 *   :current-user="currentUser"
 *   @approve-success="onApproveSuccess"
 *   @reject-success="onRejectSuccess"
 * />
 * ```
 */
import { ref, computed, watch } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { Check, Close, User, ChatLineSquare, Warning } from '@element-plus/icons-vue';
import { approvalApi, type ApprovalHistoryItem, type ApprovalAction } from '@/types/approval';

// Props 定义
interface Props {
  /** 工单ID */
  workOrderId: string;
  /** 当前工单状态 */
  currentStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Processing' | 'Closed';
  /** 当前处理人ID */
  currentHandler?: string;
  /** 当前操作用户 */
  currentUser?: { id: string; name?: string };
  /** 是否显示操作按钮 */
  showActions?: boolean;
  /** 是否显示时间线 */
  showTimeline?: boolean;
  /** 时间线初始加载条数 */
  pageSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
  currentStatus: 'Pending',
  currentHandler: '',
  currentUser: () => ({ id: '' }),
  showActions: true,
  showTimeline: true,
  pageSize: 10,
});

// Emits 定义
interface Emits {
  /** 审批通过成功 */
  (e: 'approve-success', data: any): void;
  /** 驳回成功 */
  (e: 'reject-success', data: any): void;
  /** 审批操作失败 */
  (e: 'action-error', error: Error): void;
  /** 历史记录加载成功 */
  (e: 'history-loaded', history: ApprovalHistoryItem[]): void;
}

const emit = defineEmits<Emits>();

// 状态定义
const showApproveDialog = ref(false);
const showRejectDialog = ref(false);
const approving = ref(false);
const rejecting = ref(false);
const loadingMore = ref(false);
const historyList = ref<ApprovalHistoryItem[]>([]);
const currentPage = ref(1);
const hasMore = ref(false);

// 表单数据
const approveForm = ref({
  comment: '',
});

const rejectForm = ref({
  reason: '',
});

// 表单引用
const rejectFormRef = ref<FormInstance>();

// 驳回表单校验规则
const rejectRules: FormRules = {
  reason: [
    { required: true, message: '请输入驳回原因', trigger: 'blur' },
    { min: 5, message: '驳回原因至少需要5个字符', trigger: 'blur' },
  ],
};

// 计算属性
/**
 * 是否可以审批通过
 */
const canApprove = computed(() => {
  if (props.currentStatus !== 'Pending') return false;
  if (!props.currentUser?.id) return false;
  // 仅处理人或管理员可以审批
  return props.currentHandler === props.currentUser.id || props.currentUser.role === 'admin';
});

/**
 * 是否可以驳回
 */
const canReject = computed(() => {
  if (props.currentStatus !== 'Pending') return false;
  if (!props.currentUser?.id) return false;
  return props.currentHandler === props.currentUser.id || props.currentUser.role === 'admin';
});

// 方法

/**
 * 处理审批通过按钮点击
 */
function handleApprove() {
  if (!canApprove.value) {
    ElMessage.warning('您没有审批权限或工单状态不允许审批');
    return;
  }
  showApproveDialog.value = true;
}

/**
 * 确认审批通过
 */
async function confirmApprove() {
  try {
    approving.value = true;
    
    const result = await approvalApi.approve(props.workOrderId, {
      comment: approveForm.value.comment,
    });
    
    ElMessage.success('审批成功');
    showApproveDialog.value = false;
    emit('approve-success', result);
    
    // 刷新历史记录
    await loadHistory();
  } catch (error: any) {
    ElMessage.error(error.message || '审批失败');
    emit('action-error', error);
  } finally {
    approving.value = false;
  }
}

/**
 * 确认驳回
 */
async function confirmReject() {
  try {
    // 表单校验
    const valid = await rejectFormRef.value?.validate();
    if (!valid) return;
    
    rejecting.value = true;
    
    const result = await approvalApi.reject(props.workOrderId, {
      reason: rejectForm.value.reason,
    });
    
    ElMessage.success('驳回成功');
    showRejectDialog.value = false;
    emit('reject-success', result);
    
    // 刷新历史记录
    await loadHistory();
  } catch (error: any) {
    ElMessage.error(error.message || '驳回失败');
    emit('action-error', error);
  } finally {
    rejecting.value = false;
  }
}

/**
 * 重置审批通过表单
 */
function resetApproveForm() {
  approveForm.value.comment = '';
}

/**
 * 重置驳回表单
 */
function resetRejectForm() {
  rejectForm.value.reason = '';
  rejectFormRef.value?.resetFields();
}

/**
 * 加载审批历史记录
 */
async function loadHistory() {
  try {
    const result = await approvalApi.getHistory(props.workOrderId, {
      page: 1,
      page_size: props.pageSize,
    });
    
    historyList.value = result.items || [];
    hasMore.value = result.items?.length === props.pageSize;
    currentPage.value = 1;
    
    emit('history-loaded', historyList.value);
  } catch (error: any) {
    console.error('加载审批历史失败:', error);
    ElMessage.error('加载审批历史失败');
  }
}

/**
 * 加载更多历史记录
 */
async function loadMoreHistory() {
  try {
    loadingMore.value = true;
    
    const nextPage = currentPage.value + 1;
    const result = await approvalApi.getHistory(props.workOrderId, {
      page: nextPage,
      page_size: props.pageSize,
    });
    
    if (result.items && result.items.length > 0) {
      historyList.value = [...historyList.value, ...result.items];
      currentPage.value = nextPage;
      hasMore.value = result.items.length === props.pageSize;
    } else {
      hasMore.value = false;
    }
  } catch (error: any) {
    console.error('加载更多历史记录失败:', error);
    ElMessage.error('加载更多历史记录失败');
  } finally {
    loadingMore.value = false;
  }
}

/**
 * 获取时间线项的类型
 */
function getTimelineItemType(action: ApprovalAction): '' | 'success' | 'danger' | 'primary' {
  switch (action) {
    case 'approve':
      return 'success';
    case 'reject':
      return 'danger';
    default:
      return 'primary';
  }
}

/**
 * 获取操作文本描述
 */
function getActionText(action: ApprovalAction): string {
  switch (action) {
    case 'approve':
      return '审批通过';
    case 'reject':
      return '已驳回';
    default:
      return '未知操作';
  }
}

/**
 * 格式化时间
 */
function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  
  const date = new Date(timeStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 监听工单ID变化，自动加载历史记录
watch(
  () => props.workOrderId,
  (newId) => {
    if (newId && props.showTimeline) {
      loadHistory();
    }
  },
  { immediate: true }
);

// 暴露方法供父组件调用
defineExpose({
  loadHistory,
  loadMoreHistory,
});
</script>

<style scoped lang="scss">
.approval-container {
  .approval-actions {
    display: flex;
    gap: 12px;
    padding: 16px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .approval-timeline {
    background: var(--el-bg-color);
    border-radius: 8px;
    padding: 16px;

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }

      .timeline-count {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    .timeline-item-content {
      .timeline-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .timeline-action {
          font-weight: 600;
          font-size: 14px;

          &.action-approve {
            color: var(--el-color-success);
          }

          &.action-reject {
            color: var(--el-color-danger);
          }
        }

        .timeline-time {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }

      .timeline-item-body {
        font-size: 14px;
        color: var(--el-text-color-regular);

        .timeline-operator {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;

          .el-icon {
            color: var(--el-color-primary);
          }
        }

        .timeline-comment,
        .timeline-reason {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          margin-top: 6px;
          padding: 8px;
          background: var(--el-fill-color-light);
          border-radius: 4px;
          word-break: break-word;

          .el-icon {
            flex-shrink: 0;
            margin-top: 2px;
          }
        }

        .timeline-reason {
          background: var(--el-color-danger-light-9);

          .el-icon {
            color: var(--el-color-danger);
          }
        }
      }
    }

    .timeline-load-more {
      display: flex;
      justify-content: center;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--el-border-color-lighter);
    }
  }
}
</style>