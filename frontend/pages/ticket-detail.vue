<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p class="mt-4 text-gray-600">加载工单详情...</p>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="max-w-4xl mx-auto mt-8 p-6 bg-red-50 border border-red-200 rounded-lg">
      <div class="flex items-center gap-3 text-red-700">
        <AlertCircle class="w-6 h-6" />
        <div>
          <h3 class="font-semibold">加载失败</h3>
          <p class="text-sm mt-1">{{ error }}</p>
        </div>
      </div>
      <button 
        @click="loadTicketDetail" 
        class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
      >
        重试
      </button>
    </div>

    <!-- 工单详情内容 -->
    <div v-else-if="ticket" class="max-w-4xl mx-auto py-8 px-4">
      <!-- 头部信息 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-3 mb-2">
                <span class="px-3 py-1 text-sm font-medium rounded-full"
                      :class="statusClass(ticket.status)">
                  {{ statusLabel(ticket.status) }}
                </span>
                <span class="text-gray-500 text-sm">工单号: {{ ticket.id }}</span>
              </div>
              <h1 class="text-2xl font-bold text-gray-900">{{ ticket.title }}</h1>
            </div>
            <div class="flex gap-2">
              <button 
                v-if="canEdit"
                @click="handleEdit"
                class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                <Edit class="w-4 h-4 inline mr-1" />
                编辑
              </button>
              <button 
                v-if="canSubmit"
                @click="handleSubmit"
                class="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                <Send class="w-4 h-4 inline mr-1" />
                提交审批
              </button>
            </div>
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="px-6 py-4">
          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">创建人</label>
              <p class="text-gray-900">{{ ticket.creatorName || '系统' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">创建时间</label>
              <p class="text-gray-900">{{ formatDate(ticket.createdAt) }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">当前审批人</label>
              <p class="text-gray-900">{{ currentApprover || '无' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-500 mb-1">更新时间</label>
              <p class="text-gray-900">{{ formatDate(ticket.updatedAt) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 工单描述 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText class="w-5 h-5 text-gray-500" />
            工单描述
          </h2>
        </div>
        <div class="px-6 py-4">
          <p class="text-gray-700 whitespace-pre-wrap">{{ ticket.description || '暂无描述' }}</p>
        </div>
      </div>

      <!-- 审批流程状态 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <GitBranch class="w-5 h-5 text-gray-500" />
            审批流程
          </h2>
        </div>
        <div class="px-6 py-4">
          <div v-if="approvalSteps.length > 0" class="space-y-4">
            <div 
              v-for="(step, index) in approvalSteps" 
              :key="step.id"
              class="flex items-start gap-4"
            >
              <!-- 流程节点 -->
              <div class="flex flex-col items-center">
                <div 
                  class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                  :class="stepStatusClass(step.status)"
                >
                  <Check v-if="step.status === 'COMPLETED'" class="w-4 h-4" />
                  <X v-else-if="step.status === 'REJECTED'" class="w-4 h-4" />
                  <Clock v-else class="w-4 h-4" />
                </div>
                <div v-if="index < approvalSteps.length - 1" class="w-0.5 h-8 bg-gray-200"></div>
              </div>
              
              <!-- 流程信息 -->
              <div class="flex-1 pb-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-medium text-gray-900">{{ step.approverName }}</p>
                    <p class="text-sm text-gray-500">{{ step.roleName }}</p>
                  </div>
                  <span 
                    class="px-2 py-1 text-xs font-medium rounded"
                    :class="stepStatusLabelClass(step.status)"
                  >
                    {{ stepStatusLabel(step.status) }}
                  </span>
                </div>
                <p v-if="step.completedAt" class="text-sm text-gray-500 mt-1">
                  {{ formatDate(step.completedAt) }}
                </p>
                <p v-if="step.comment" class="text-sm text-gray-700 mt-2 bg-gray-50 p-3 rounded">
                  {{ step.comment }}
                </p>
              </div>
            </div>
          </div>
          <div v-else class="text-center text-gray-500 py-8">
            <Inbox class="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p>暂无审批记录</p>
          </div>
        </div>
      </div>

      <!-- 审批操作 (Phase 2 预留，当前隐藏) -->
      <div v-if="showApprovalActions" class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle class="w-5 h-5 text-gray-500" />
            审批操作
          </h2>
        </div>
        <div class="px-6 py-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">审批意见</label>
            <textarea 
              v-model="approvalComment"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="请输入审批意见（可选）"
            ></textarea>
          </div>
          <div class="flex gap-3">
            <button 
              @click="handleApprove"
              class="px-6 py-2 text-white bg-green-600 rounded hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Check class="w-4 h-4" />
              通过
            </button>
            <button 
              @click="handleReject"
              class="px-6 py-2 text-white bg-red-600 rounded hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <X class="w-4 h-4" />
              拒绝
            </button>
            <button 
              @click="handleReturn"
              class="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <RotateCcw class="w-4 h-4" />
              退回
            </button>
          </div>
        </div>
      </div>

      <!-- 操作日志 -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <History class="w-5 h-5 text-gray-500" />
            操作日志
          </h2>
        </div>
        <div class="px-6 py-4">
          <div v-if="operationLogs.length > 0" class="space-y-3">
            <div 
              v-for="log in operationLogs" 
              :key="log.id"
              class="flex items-start gap-3 text-sm"
            >
              <div class="w-2 h-2 mt-2 rounded-full bg-gray-400"></div>
              <div class="flex-1">
                <p class="text-gray-700">
                  <span class="font-medium text-gray-900">{{ log.operatorName }}</span>
                  {{ log.action }}
                </p>
                <p class="text-gray-500 text-xs mt-1">{{ formatDate(log.createdAt) }}</p>
              </div>
            </div>
          </div>
          <div v-else class="text-center text-gray-500 py-8">
            <Inbox class="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p>暂无操作记录</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 工单详情页面组件
 * 
 * @description 用于展示工单的完整信息，包括基本信息、审批流程、操作日志等
 * @module pages/ticket-detail
 * @requires vue, vue-router, lucide-vue-next
 * @author SWARM-001 Team
 * @version 1.0.0
 * 
 * @features
 * - 工单基本信息展示（标题、描述、状态、创建人等）
 * - 审批流程状态可视化
 * - 审批操作按钮（通过/拒绝/退回）- Phase 2 实现
 * - 操作日志展示
 * - 实时通知集成 - Phase 3 实现
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertCircle,
  Check,
  X,
  Clock,
  Edit,
  Send,
  FileText,
  GitBranch,
  CheckCircle,
  RotateCcw,
  History,
  Inbox
} from 'lucide-vue-next';

// 类型定义
interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  creatorId: string;
  creatorName: string;
  currentApproverId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalStep {
  id: string;
  approverId: string;
  approverName: string;
  roleName: string;
  status: ApprovalStepStatus;
  completedAt: string | null;
  comment: string | null;
}

interface OperationLog {
  id: string;
  operatorId: string;
  operatorName: string;
  action: string;
  createdAt: string;
}

type TicketStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type ApprovalStepStatus = 'PENDING' | 'COMPLETED' | 'REJECTED' | 'SKIPPED';

// 响应式状态
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const error = ref<string | null>(null);
const ticket = ref<Ticket | null>(null);
const approvalSteps = ref<ApprovalStep[]>([]);
const operationLogs = ref<OperationLog[]>([]);
const approvalComment = ref('');

// 计算属性
/**
 * 判断当前用户是否可以编辑工单
 * @returns {boolean}
 */
const canEdit = computed(() => {
  if (!ticket.value) return false;
  return ticket.value.status === 'DRAFT';
});

/**
 * 判断当前用户是否可以提交工单
 * @returns {boolean}
 */
const canSubmit = computed(() => {
  if (!ticket.value) return false;
  return ticket.value.status === 'DRAFT';
});

/**
 * 判断是否显示审批操作区域
 * @description Phase 1 隐藏，Phase 2 实现后显示
 * @returns {boolean}
 */
const showApprovalActions = computed(() => {
  if (!ticket.value) return false;
  return ticket.value.status === 'IN_REVIEW';
});

/**
 * 获取当前审批人名称
 * @returns {string}
 */
const currentApprover = computed(() => {
  const currentStep = approvalSteps.value.find(s => s.status === 'PENDING');
  return currentStep?.approverName || '无';
});

// 方法

/**
 * 加载工单详情数据
 * @async
 * @returns {Promise<void>}
 */
const loadTicketDetail = async () => {
  const ticketId = route.params.id as string;
  
  if (!ticketId) {
    error.value = '工单ID无效';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // 模拟 API 调用
    // 实际项目中应调用: await ticketApi.getTicketDetail(ticketId)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 模拟数据
    ticket.value = {
      id: ticketId,
      title: '采购申请：办公设备更新',
      description: '因业务发展需要，现申请采购以下办公设备：\n1. 笔记本电脑 5台\n2. 显示器 10台\n3. 办公桌椅 5套\n\n预算：¥50,000',
      status: 'IN_REVIEW',
      creatorId: 'user-001',
      creatorName: '张三',
      currentApproverId: 'user-002',
      createdAt: '2024-01-15T09:30:00Z',
      updatedAt: '2024-01-16T14:20:00Z'
    };

    approvalSteps.value = [
      {
        id: 'step-001',
        approverId: 'user-002',
        approverName: '李经理',
        roleName: '部门经理',
        status: 'COMPLETED',
        completedAt: '2024-01-15T10:30:00Z',
        comment: '同意采购，按预算执行'
      },
      {
        id: 'step-002',
        approverId: 'user-003',
        approverName: '王总监',
        roleName: '财务总监',
        status: 'PENDING',
        completedAt: null,
        comment: null
      }
    ];

    operationLogs.value = [
      {
        id: 'log-001',
        operatorId: 'user-001',
        operatorName: '张三',
        action: '创建了工单',
        createdAt: '2024-01-15T09:30:00Z'
      },
      {
        id: 'log-002',
        operatorId: 'user-001',
        operatorName: '张三',
        action: '提交了工单审批',
        createdAt: '2024-01-15T09:35:00Z'
      },
      {
        id: 'log-003',
        operatorId: 'user-002',
        operatorName: '李经理',
        action: '通过了工单',
        createdAt: '2024-01-15T10:30:00Z'
      }
    ];
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载工单详情失败';
  } finally {
    loading.value = false;
  }
};

/**
 * 获取状态对应的 CSS 类名
 * @param {TicketStatus} status - 工单状态
 * @returns {string} CSS 类名
 */
const statusClass = (status: TicketStatus): string => {
  const classes: Record<TicketStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    IN_REVIEW: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500'
  };
  return classes[status] || 'bg-gray-100 text-gray-700';
};

/**
 * 获取状态标签文本
 * @param {TicketStatus} status - 工单状态
 * @returns {string} 状态标签
 */
const statusLabel = (status: TicketStatus): string => {
  const labels: Record<TicketStatus, string> = {
    DRAFT: '草稿',
    SUBMITTED: '已提交',
    IN_REVIEW: '审核中',
    APPROVED: '已通过',
    REJECTED: '已拒绝',
    CANCELLED: '已取消'
  };
  return labels[status] || status;
};

/**
 * 获取审批步骤状态 CSS 类名
 * @param {ApprovalStepStatus} status - 审批步骤状态
 * @returns {string} CSS 类名
 */
const stepStatusClass = (status: ApprovalStepStatus): string => {
  const classes: Record<ApprovalStepStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    SKIPPED: 'bg-gray-100 text-gray-500'
  };
  return classes[status] || 'bg-gray-100 text-gray-700';
};

/**
 * 获取审批步骤状态标签 CSS 类名
 * @param {ApprovalStepStatus} status - 审批步骤状态
 * @returns {string} CSS 类名
 */
const stepStatusLabelClass = (status: ApprovalStepStatus): string => {
  const classes: Record<ApprovalStepStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    SKIPPED: 'bg-gray-100 text-gray-500'
  };
  return classes[status] || 'bg-gray-100 text-gray-700';
};

/**
 * 获取审批步骤状态标签文本
 * @param {ApprovalStepStatus} status - 审批步骤状态
 * @returns {string} 状态标签
 */
const stepStatusLabel = (status: ApprovalStepStatus): string => {
  const labels: Record<ApprovalStepStatus, string> = {
    PENDING: '待审批',
    COMPLETED: '已通过',
    REJECTED: '已拒绝',
    SKIPPED: '已跳过'
  };
  return labels[status] || status;
};

/**
 * 格式化日期
 * @param {string} dateString - ISO 日期字符串
 * @returns {string} 格式化后的日期
 */
const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 编辑工单处理函数
 * @returns {void}
 */
const handleEdit = () => {
  if (ticket.value) {
    router.push(`/ticket/edit/${ticket.value.id}`);
  }
};

/**
 * 提交工单处理函数
 * @async
 * @returns {Promise<void>}
 */
const handleSubmit = async () => {
  if (!ticket.value) return;
  
  try {
    // 模拟 API 调用
    // 实际项目中应调用: await ticketApi.submitTicket(ticket.value.id)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    ticket.value.status = 'SUBMITTED';
    alert('工单已提交');
  } catch (e) {
    alert('提交失败');
  }
};

/**
 * 通过审批处理函数
 * @async
 * @returns {Promise<void>}
 */
const handleApprove = async () => {
  if (!ticket.value) return;
  
  try {
    // 模拟 API 调用 - Phase 2 实现
    // 实际项目中应调用: await approvalApi.approve(ticket.value.id, approvalComment.value)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    alert('审批通过');
    approvalComment.value = '';
    await loadTicketDetail();
  } catch (e) {
    alert('操作失败');
  }
};

/**
 * 拒绝审批处理函数
 * @async
 * @returns {Promise<void>}
 */
const handleReject = async () => {
  if (!ticket.value) return;
  
  try {
    // 模拟 API 调用 - Phase 2 实现
    // 实际项目中应调用: await approvalApi.reject(ticket.value.id, approvalComment.value)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    alert('已拒绝');
    approvalComment.value = '';
    await loadTicketDetail();
  } catch (e) {
    alert('操作失败');
  }
};

/**
 * 退回工单处理函数
 * @async
 * @returns {Promise<void>}
 */
const handleReturn = async () => {
  if (!ticket.value) return;
  
  try {
    // 模拟 API 调用 - Phase 2 实现
    // 实际项目中应调用: await approvalApi.returnToCreator(ticket.value.id, approvalComment.value)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    alert('已退回');
    approvalComment.value = '';
    await loadTicketDetail();
  } catch (e) {
    alert('操作失败');
  }
};

// 生命周期钩子
onMounted(() => {
  loadTicketDetail();
});

onUnmounted(() => {
  // 清理工作 - 取消 WebSocket 订阅等
});
</script>

<style scoped>
/**
 * 工单详情页面样式
 * @styles
 * - 页面容器样式
 * - 卡片样式
 * - 状态标签样式
 * - 流程节点样式
 */

/* 页面容器 */
.min-h-screen {
  min-height: 100vh;
}

/* 加载动画 */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 流程节点连接线 */
.w-0\.5 {
  width: 0.125rem;
}
</style>