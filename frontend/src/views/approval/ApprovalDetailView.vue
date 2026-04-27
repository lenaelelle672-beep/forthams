<template>
  <div class="approval-detail-view">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-skeleton">
        <el-skeleton :rows="10" animated />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="errorState" class="error-alert">
      <el-alert
        type="error"
        :title="errorState.message || '加载审批详情失败'"
        :description="errorState.code"
        show-icon
        :closable="false"
      >
        <template #default>
          <div class="error-actions">
            <el-button type="primary" @click="handleRetry">
              重试
            </el-button>
            <el-button @click="goBack">返回列表</el-button>
          </div>
        </template>
      </el-alert>
    </div>

    <!-- Empty State -->
    <div v-else-if="!currentApproval" class="empty-state">
      <el-empty description="审批详情不存在">
        <el-button type="primary" @click="goBack">返回列表</el-button>
      </el-empty>
    </div>

    <!-- Approval Detail Content -->
    <div v-else class="detail-content">
      <!-- Header Section -->
      <div class="detail-header">
        <div class="header-left">
          <h1 class="detail-title">{{ currentApproval.title || '审批详情' }}</h1>
          <ApprovalStatusBadge :status="currentApproval.status" />
        </div>
        <div class="header-actions">
          <el-button @click="goBack">返回</el-button>
          <ApprovalActionPanel
            v-if="canPerformAction"
            :approval-id="approvalId"
            :current-status="currentApproval.status"
            :disabled="isOperationLocked"
            @success="handleActionSuccess"
            @error="handleActionError"
          />
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="detail-grid">
        <!-- Left Column: Basic Info -->
        <div class="info-section">
          <el-card class="info-card">
            <template #header>
              <span class="section-title">基本信息</span>
            </template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="审批编号">
                {{ currentApproval.id }}
              </el-descriptions-item>
              <el-descriptions-item label="申请人">
                {{ currentApproval.applicantName || currentApproval.applicant || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="申请部门">
                {{ currentApproval.department || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="申请时间">
                {{ formatDateTime(currentApproval.createdAt || currentApproval.createTime) }}
              </el-descriptions-item>
              <el-descriptions-item label="当前审批人">
                {{ currentApproval.currentApprover || currentApproval.approver || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="优先级">
                <span :class="getPriorityClass(currentApproval.priority)">
                  {{ getPriorityText(currentApproval.priority) }}
                </span>
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <!-- Asset Info (if applicable) -->
          <el-card v-if="currentApproval.assetId" class="info-card">
            <template #header>
              <span class="section-title">关联资产</span>
            </template>
            <div class="asset-info">
              <p><strong>资产编号：</strong>{{ currentApproval.assetId }}</p>
              <p><strong>资产名称：</strong>{{ currentApproval.assetName || '-' }}</p>
              <el-button 
                type="primary" 
                link 
                @click="navigateToAsset(currentApproval.assetId)"
              >
                查看资产详情
              </el-button>
            </div>
          </el-card>
        </div>

        <!-- Right Column: Description & Reason -->
        <div class="content-section">
          <el-card class="info-card">
            <template #header>
              <span class="section-title">申请说明</span>
            </template>
            <div class="description-content">
              <p v-if="currentApproval.description">{{ currentApproval.description }}</p>
              <p v-else class="no-data">暂无申请说明</p>
            </div>
          </el-card>

          <el-card v-if="currentApproval.reason" class="info-card">
            <template #header>
              <span class="section-title">申请原因</span>
            </template>
            <div class="description-content">
              <p>{{ currentApproval.reason }}</p>
            </div>
          </el-card>

          <!-- Attachments -->
          <el-card v-if="currentApproval.attachments?.length" class="info-card">
            <template #header>
              <span class="section-title">附件</span>
            </template>
            <div class="attachments-list">
              <div 
                v-for="(attachment, index) in currentApproval.attachments" 
                :key="index"
                class="attachment-item"
              >
                <el-icon><Document /></el-icon>
                <span>{{ attachment.name || attachment.fileName }}</span>
                <el-button type="primary" link @click="downloadAttachment(attachment)">
                  下载
                </el-button>
              </div>
            </div>
          </el-card>
        </div>
      </div>

      <!-- Approval History -->
      <el-card class="history-card">
        <template #header>
          <span class="section-title">审批历史</span>
        </template>
        <div v-if="approvalHistory.length" class="history-timeline">
          <el-timeline>
            <el-timeline-item
              v-for="(record, index) in approvalHistory"
              :key="index"
              :timestamp="formatDateTime(record.timestamp || record.createTime)"
              :type="getHistoryType(record.action)"
              placement="top"
            >
              <el-card class="history-item">
                <div class="history-content">
                  <div class="history-header">
                    <strong>{{ record.operatorName || record.operator || '系统' }}</strong>
                    <span class="history-action">{{ getActionText(record.action) }}</span>
                  </div>
                  <p v-if="record.comment" class="history-comment">
                    {{ record.comment }}
                  </p>
                  <p v-if="record.remark" class="history-remark">
                    备注：{{ record.remark }}
                  </p>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </div>
        <div v-else class="no-history">
          <el-empty description="暂无审批历史" :image-size="60" />
        </div>
      </el-card>
    </div>

    <!-- Operation Feedback Toast -->
    <el-dialog
      v-model="showFeedback"
      :title="feedbackType === 'success' ? '操作成功' : '操作失败'"
      width="400px"
      :close-on-click-modal="false"
    >
      <div class="feedback-content">
        <el-icon v-if="feedbackType === 'success'" class="feedback-icon success">
          <CircleCheckFilled />
        </el-icon>
        <el-icon v-else class="feedback-icon error">
          <CircleCloseFilled />
        </el-icon>
        <p>{{ feedbackMessage }}</p>
      </div>
      <template #footer>
        <el-button @click="showFeedback = false">关闭</el-button>
        <el-button v-if="feedbackType === 'error'" type="primary" @click="handleRetryFailed">
          重试
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * ApprovalDetailView - 审批详情页视图组件
 * 
 * 功能说明：
 * - 展示审批详情信息
 * - 支持审批操作（通过/驳回）
 * - 显示审批历史记录
 * - 实现与 ApprovalService 的双向绑定
 * 
 * 绑定数据：
 * - currentApproval: 审批详情数据
 * - loadingState: 加载状态
 * - errorState: 错误状态
 * - pendingOperations: 操作锁定状态
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Document, CircleCheckFilled, CircleCloseFilled } from '@element-plus/icons-vue';
import { useApprovalStore } from '@/stores/approvalStore';
import { useApprovalBinding } from '@/composables/useApprovalBinding';
import ApprovalStatusBadge from '@/components/approval/ApprovalStatusBadge.vue';
import ApprovalActionPanel from '@/components/approval/ApprovalActionPanel.vue';
import type { Approval, ApprovalRecord } from '@/types/approval';

defineOptions({
  name: 'ApprovalDetailView'
});

// Router & Store
const route = useRoute();
const router = useRouter();
const approvalStore = useApprovalStore();
const { bindApprovalDetail, unbindApprovalDetail } = useApprovalBinding();

// Local State
const approvalId = ref<string>('');
const showFeedback = ref(false);
const feedbackType = ref<'success' | 'error'>('success');
const feedbackMessage = ref('');

// Computed: Bind to Store State
const currentApproval = computed(() => approvalStore.currentApproval);
const isLoading = computed(() => approvalStore.loadingState?.isLoading ?? false);
const errorState = computed(() => approvalStore.errorState);
const pendingOperations = computed(() => approvalStore.pendingOperations);

// Computed: Derived State
const isOperationLocked = computed(() => 
  pendingOperations.value.has(approvalId.value)
);

const canPerformAction = computed(() => {
  const status = currentApproval.value?.status;
  // 可操作的审批状态：PENDING, UNDER_REVIEW, IN_PROGRESS
  return status && ['PENDING', 'UNDER_REVIEW', 'IN_PROGRESS'].includes(status);
});

const approvalHistory = computed<ApprovalRecord[]>(() => {
  return currentApproval.value?.history || currentApproval.value?.records || [];
});

// Methods

/**
 * 加载审批详情
 * 通过 ApprovalService 获取数据并绑定到 Store
 */
const loadApprovalDetail = async () => {
  if (!approvalId.value) return;
  
  try {
    await bindApprovalDetail(approvalId.value);
  } catch (error) {
    console.error('Failed to load approval detail:', error);
  }
};

/**
 * 返回列表页
 */
const goBack = () => {
  router.push('/approval/list');
};

/**
 * 重试加载
 */
const handleRetry = () => {
  loadApprovalDetail();
};

/**
 * 操作成功回调
 */
const handleActionSuccess = (result: { message?: string }) => {
  feedbackType.value = 'success';
  feedbackMessage.value = result?.message || '操作成功';
  showFeedback.value = true;
  
  // 刷新详情数据
  loadApprovalDetail();
};

/**
 * 操作失败回调
 */
const handleActionError = (error: { message?: string }) => {
  feedbackType.value = 'error';
  feedbackMessage.value = error?.message || '操作失败，请重试';
  showFeedback.value = true;
};

/**
 * 重试失败的操作
 */
const handleRetryFailed = () => {
  showFeedback.value = false;
  // 由 ApprovalActionPanel 组件处理重试逻辑
};

/**
 * 格式化日期时间
 */
const formatDateTime = (date: string | Date | undefined): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 获取优先级样式类
 */
const getPriorityClass = (priority?: string | number): string => {
  const priorityMap: Record<string, string> = {
    HIGH: 'priority-high',
    MEDIUM: 'priority-medium',
    LOW: 'priority-low',
    URGENT: 'priority-urgent',
    NORMAL: 'priority-normal'
  };
  return priorityMap[String(priority).toUpperCase()] || 'priority-normal';
};

/**
 * 获取优先级文本
 */
const getPriorityText = (priority?: string | number): string => {
  const textMap: Record<string, string> = {
    HIGH: '高',
    MEDIUM: '中',
    LOW: '低',
    URGENT: '紧急',
    NORMAL: '普通'
  };
  return textMap[String(priority).toUpperCase()] || '普通';
};

/**
 * 获取历史记录类型
 */
const getHistoryType = (action?: string): string => {
  const typeMap: Record<string, string> = {
    APPROVE: 'success',
    REJECT: 'danger',
    SUBMIT: 'primary',
    TRANSFER: 'warning',
    COMMENT: 'info'
  };
  return typeMap[String(action).toUpperCase()] || 'info';
};

/**
 * 获取操作文本
 */
const getActionText = (action?: string): string => {
  const textMap: Record<string, string> = {
    SUBMIT: '提交申请',
    APPROVE: '审批通过',
    REJECT: '审批驳回',
    TRANSFER: '转交',
    COMMENT: '批注',
    CANCEL: '撤回'
  };
  return textMap[String(action).toUpperCase()] || action || '未知操作';
};

/**
 * 跳转到资产详情页
 */
const navigateToAsset = (assetId: string) => {
  router.push(`/asset/${assetId}`);
};

/**
 * 下载附件
 */
const downloadAttachment = (attachment: { url?: string; name?: string }) => {
  if (attachment.url) {
    window.open(attachment.url, '_blank');
  } else {
    ElMessage.warning('附件地址不可用');
  }
};

// Lifecycle
onMounted(() => {
  // 从路由参数获取审批 ID
  approvalId.value = String(route.params.id || route.query.id || '');
  
  if (approvalId.value) {
    loadApprovalDetail();
  } else {
    ElMessage.error('审批ID不能为空');
    goBack();
  }
});

// Watch for route changes
watch(
  () => route.params.id,
  (newId) => {
    if (newId && newId !== approvalId.value) {
      approvalId.value = String(newId);
      loadApprovalDetail();
    }
  }
);

// Cleanup on unmount
onUnmounted(() => {
  unbindApprovalDetail();
});
</script>

<style scoped>
.approval-detail-view {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: calc(100vh - 120px);
}

/* Loading State */
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.loading-skeleton {
  width: 100%;
  max-width: 900px;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
}

/* Error State */
.error-alert {
  max-width: 600px;
  margin: 100px auto;
}

.error-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

/* Empty State */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

/* Detail Header */
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.detail-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Detail Grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

@media (max-width: 1024px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

.info-section,
.content-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Info Card */
.info-card {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.info-card :deep(.el-card__header) {
  padding: 16px 20px;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

/* Asset Info */
.asset-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.asset-info p {
  margin: 0;
  color: #606266;
}

/* Description Content */
.description-content {
  color: #606266;
  line-height: 1.8;
}

.no-data {
  color: #909399;
  font-style: italic;
}

/* Attachments */
.attachments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.attachment-item .el-icon {
  color: #409eff;
}

.attachment-item span {
  flex: 1;
  color: #606266;
}

/* Priority Styles */
.priority-high,
.priority-urgent {
  color: #f56c6c;
  font-weight: 600;
}

.priority-medium {
  color: #e6a23c;
  font-weight: 600;
}

.priority-low,
.priority-normal {
  color: #909399;
}

/* History Card */
.history-card {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.history-card :deep(.el-card__header) {
  padding: 16px 20px;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
}

.history-timeline {
  padding: 16px 0;
}

.history-item {
  margin-bottom: 8px;
}

.history-content {
  padding: 8px 0;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.history-action {
  color: #606266;
  font-size: 14px;
}

.history-comment {
  margin: 8px 0 0;
  color: #409eff;
  padding: 8px 12px;
  background: #ecf5ff;
  border-radius: 4px;
  line-height: 1.6;
}

.history-remark {
  margin: 8px 0 0;
  color: #909399;
  font-size: 13px;
}

.no-history {
  padding: 40px 0;
}

/* Feedback Dialog */
.feedback-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
}

.feedback-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.feedback-icon.success {
  color: #67c23a;
}

.feedback-icon.error {
  color: #f56c6c;
}

.feedback-content p {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

/* Detail Content Animation */
.detail-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>