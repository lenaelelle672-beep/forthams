/**
 * TicketList.vue - 工单列表组件
 * 
 * 功能描述：
 * - 展示所有工单列表，支持分页和状态筛选
 * - 提供工单创建入口
 * - 支持工单详情跳转
 * 
 * 依赖服务：
 * - TicketService: 工单 CRUD 操作
 * - approvalStore: 审批状态管理
 * 
 * @author SWARM-001 Team
 * @version 1.0.0
 */

<template>
  <div class="ticket-list-container" data-testid="ticket-list-container">
    <!-- 头部工具栏 -->
    <div class="ticket-list-header" data-testid="ticket-list-header">
      <div class="header-left">
        <h1 class="page-title">工单管理</h1>
        <span class="ticket-count">共 {{ totalCount }} 条工单</span>
      </div>
      <div class="header-right">
        <button 
          class="btn-create"
          data-testid="btn-create-ticket"
          @click="handleCreateTicket"
        >
          <span class="btn-icon">+</span>
          创建工单
        </button>
      </div>
    </div>

    <!-- 筛选工具栏 -->
    <div class="filter-toolbar" data-testid="ticket-filter-toolbar">
      <div class="filter-group">
        <label class="filter-label">状态筛选：</label>
        <select 
          v-model="selectedStatus"
          class="filter-select"
          data-testid="filter-status-select"
          @change="handleStatusFilterChange"
        >
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="SUBMITTED">已提交</option>
          <option value="APPROVED">已批准</option>
          <option value="REJECTED">已拒绝</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label class="filter-label">排序：</label>
        <select 
          v-model="sortOrder"
          class="filter-select"
          data-testid="filter-sort-select"
          @change="handleSortChange"
        >
          <option value="desc">最新优先</option>
          <option value="asc">最早优先</option>
        </select>
      </div>

      <button 
        class="btn-refresh"
        data-testid="btn-refresh-list"
        @click="handleRefresh"
        :disabled="isLoading"
      >
        <span :class="['refresh-icon', { spinning: isLoading }]">⟳</span>
        刷新
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state" data-testid="ticket-list-loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="errorMessage" class="error-state" data-testid="ticket-list-error">
      <span class="error-icon">⚠</span>
      <span class="error-text">{{ errorMessage }}</span>
      <button class="btn-retry" @click="handleRefresh">重试</button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="tickets.length === 0" class="empty-state" data-testid="ticket-list-empty">
      <span class="empty-icon">📋</span>
      <span class="empty-text">暂无工单</span>
      <button class="btn-create-empty" @click="handleCreateTicket">
        创建第一个工单
      </button>
    </div>

    <!-- 工单列表 -->
    <div v-else class="ticket-list" data-testid="ticket-list">
      <div 
        v-for="ticket in tickets" 
        :key="ticket.id"
        class="ticket-item"
        data-testid="ticket-item"
        @click="handleTicketClick(ticket.id)"
      >
        <div class="ticket-item-header">
          <span class="ticket-id">#{{ ticket.id }}</span>
          <span 
            class="ticket-status"
            :class="[`status-${ticket.status.toLowerCase()}`]"
            data-testid="ticket-status"
          >
            {{ getStatusLabel(ticket.status) }}
          </span>
        </div>
        
        <h3 class="ticket-title">{{ ticket.title }}</h3>
        
        <p v-if="ticket.description" class="ticket-description">
          {{ truncateDescription(ticket.description) }}
        </p>
        
        <div class="ticket-meta">
          <span class="ticket-creator">
            <span class="meta-icon">👤</span>
            {{ ticket.creatorName }}
          </span>
          <span class="ticket-date">
            <span class="meta-icon">📅</span>
            {{ formatDate(ticket.createdAt) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 分页组件 -->
    <div v-if="totalPages > 1" class="pagination" data-testid="ticket-pagination">
      <button 
        class="page-btn"
        data-testid="btn-prev-page"
        :disabled="currentPage === 1"
        @click="handlePageChange(currentPage - 1)"
      >
        上一页
      </button>
      
      <div class="page-info">
        第 <span class="current-page">{{ currentPage }}</span> / {{ totalPages }} 页
      </div>
      
      <button 
        class="page-btn"
        data-testid="btn-next-page"
        :disabled="currentPage === totalPages"
        @click="handlePageChange(currentPage + 1)"
      >
        下一页
      </button>
    </div>

    <!-- 创建工单模态框 -->
    <TicketCreateModal
      v-if="showCreateModal"
      data-testid="ticket-create-modal"
      @close="handleCloseCreateModal"
      @success="handleCreateSuccess"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * TicketList 组件 - 工单列表主组件
 * 
 * @description 
 * 展示工单列表，支持分页、筛选、排序等功能
 * 提供创建新工单的入口
 * 
 * @example
 * <TicketList />
 * 
 * @requires Vue 3 Composition API
 * @requires TypeScript
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import TicketCreateModal from './TicketCreateModal.vue';

/**
 * 工单状态枚举
 */
enum TicketStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

/**
 * 工单数据类型定义
 */
interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: TicketStatus;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 工单列表查询参数
 */
interface TicketQueryParams {
  page: number;
  pageSize: number;
  status?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 工单列表响应数据
 */
interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== 组件状态 ====================

/** 工单列表数据 */
const tickets = ref<Ticket[]>([]);

/** 当前页码 */
const currentPage = ref(1);

/** 每页数量 */
const pageSize = ref(10);

/** 总记录数 */
const totalCount = ref(0);

/** 总页数 */
const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value));

/** 选中的状态筛选 */
const selectedStatus = ref<string>('');

/** 排序方式 */
const sortOrder = ref<'asc' | 'desc'>('desc');

/** 加载状态 */
const isLoading = ref(false);

/** 错误信息 */
const errorMessage = ref<string>('');

/** 是否显示创建模态框 */
const showCreateModal = ref(false);

/** 路由实例 */
const router = useRouter();

// ==================== 工具函数 ====================

/**
 * 获取状态显示标签
 * 
 * @param status - 工单状态
 * @returns 状态中文标签
 */
function getStatusLabel(status: TicketStatus): string {
  const statusMap: Record<TicketStatus, string> = {
    [TicketStatus.DRAFT]: '草稿',
    [TicketStatus.SUBMITTED]: '已提交',
    [TicketStatus.APPROVED]: '已批准',
    [TicketStatus.REJECTED]: '已拒绝'
  };
  return statusMap[status] || status;
}

/**
 * 格式化日期
 * 
 * @param dateString - ISO 日期字符串
 * @returns 格式化后的日期字符串
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 截断描述文本
 * 
 * @param description - 原始描述
 * @param maxLength - 最大长度
 * @returns 截断后的描述
 */
function truncateDescription(description: string, maxLength: number = 100): string {
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + '...';
}

/**
 * 构建查询参数
 * 
 * @returns 查询参数对象
 */
function buildQueryParams(): TicketQueryParams {
  return {
    page: currentPage.value,
    pageSize: pageSize.value,
    status: selectedStatus.value || undefined,
    sortOrder: sortOrder.value
  };
}

// ==================== 数据获取 ====================

/**
 * 获取工单列表数据
 * 
 * @description 
 * 从后端 API 获取工单列表数据，支持分页和筛选
 * 
 * @throws {Error} 网络请求失败时抛出错误
 */
async function fetchTickets(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = '';
  
  try {
    const params = buildQueryParams();
    
    // 模拟 API 调用 - 实际项目中替换为真实 API
    const response = await fetch(
      `/api/tickets?page=${params.page}&pageSize=${params.pageSize}` +
      `${params.status ? `&status=${params.status}` : ''}&sortOrder=${params.sortOrder}`
    );
    
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }
    
    const data: TicketListResponse = await response.json();
    
    tickets.value = data.items;
    totalCount.value = data.total;
    currentPage.value = data.page;
    pageSize.value = data.pageSize;
    
  } catch (error) {
    console.error('获取工单列表失败:', error);
    errorMessage.value = error instanceof Error 
      ? error.message 
      : '获取工单列表失败，请稍后重试';
  } finally {
    isLoading.value = false;
  }
}

// ==================== 事件处理 ====================

/**
 * 处理工单创建
 */
function handleCreateTicket(): void {
  showCreateModal.value = true;
}

/**
 * 处理创建模态框关闭
 */
function handleCloseCreateModal(): void {
  showCreateModal.value = false;
}

/**
 * 处理创建成功
 * 
 * @description 
 * 创建成功后关闭模态框并刷新列表
 */
function handleCreateSuccess(): void {
  showCreateModal.value = false;
  fetchTickets();
}

/**
 * 处理工单点击
 * 
 * @param ticketId - 工单 ID
 */
function handleTicketClick(ticketId: string): void {
  router.push(`/tickets/${ticketId}`);
}

/**
 * 处理状态筛选变化
 */
function handleStatusFilterChange(): void {
  currentPage.value = 1;
  fetchTickets();
}

/**
 * 处理排序变化
 */
function handleSortChange(): void {
  currentPage.value = 1;
  fetchTickets();
}

/**
 * 处理分页变化
 * 
 * @param page - 目标页码
 */
function handlePageChange(page: number): void {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  fetchTickets();
}

/**
 * 处理刷新
 */
function handleRefresh(): void {
  fetchTickets();
}

// ==================== 生命周期 ====================

/**
 * 组件挂载时获取数据
 */
onMounted(() => {
  fetchTickets();
});

/**
 * 监听筛选状态变化
 */
watch(selectedStatus, () => {
  currentPage.value = 1;
  fetchTickets();
});
</script>

<style scoped>
/**
 * TicketList 组件样式
 * 
 * 采用 BEM 命名规范，遵循 Tailwind CSS 设计模式
 */

.ticket-list-container {
  @apply p-6 bg-gray-50 min-h-screen;
}

/* 头部样式 */
.ticket-list-header {
  @apply flex justify-between items-center mb-6;
}

.header-left {
  @apply flex items-center gap-4;
}

.page-title {
  @apply text-2xl font-bold text-gray-900;
}

.ticket-count {
  @apply text-sm text-gray-500;
}

.btn-create {
  @apply flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg;
  @apply hover:bg-blue-700 transition-colors;
}

.btn-icon {
  @apply text-lg font-bold;
}

/* 筛选工具栏 */
.filter-toolbar {
  @apply flex items-center gap-4 mb-6 p-4 bg-white rounded-lg shadow-sm;
}

.filter-group {
  @apply flex items-center gap-2;
}

.filter-label {
  @apply text-sm text-gray-600;
}

.filter-select {
  @apply px-3 py-2 border border-gray-300 rounded-lg text-sm;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500;
}

/* 加载状态 */
.loading-state {
  @apply flex flex-col items-center justify-center py-16;
}

.loading-spinner {
  @apply w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full;
  @apply animate-spin mb-4;
}

/* 错误状态 */
.error-state {
  @apply flex flex-col items-center justify-center py-16 text-red-600;
}

.error-icon {
  @apply text-4xl mb-4;
}

.error-text {
  @apply mb-4;
}

.btn-retry {
  @apply px-4 py-2 bg-red-600 text-white rounded-lg;
  @apply hover:bg-red-700 transition-colors;
}

/* 空状态 */
.empty-state {
  @apply flex flex-col items-center justify-center py-16;
}

.empty-icon {
  @apply text-6xl mb-4;
}

.empty-text {
  @apply text-gray-500 mb-4;
}

.btn-create-empty {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg;
  @apply hover:bg-blue-700 transition-colors;
}

/* 工单列表 */
.ticket-list {
  @apply space-y-4;
}

.ticket-item {
  @apply p-4 bg-white rounded-lg shadow-sm cursor-pointer;
  @apply hover:shadow-md transition-shadow;
}

.ticket-item-header {
  @apply flex justify-between items-center mb-2;
}

.ticket-id {
  @apply text-sm text-gray-500;
}

.ticket-status {
  @apply px-2 py-1 text-xs font-medium rounded;
}

.status-draft {
  @apply bg-gray-100 text-gray-600;
}

.status-submitted {
  @apply bg-blue-100 text-blue-600;
}

.status-approved {
  @apply bg-green-100 text-green-600;
}

.status-rejected {
  @apply bg-red-100 text-red-600;
}

.ticket-title {
  @apply text-lg font-medium text-gray-900 mb-2;
}

.ticket-description {
  @apply text-sm text-gray-600 mb-3 line-clamp-2;
}

.ticket-meta {
  @apply flex items-center gap-4 text-sm text-gray-500;
}

.ticket-creator,
.ticket-date {
  @apply flex items-center gap-1;
}

.meta-icon {
  @apply text-base;
}

/* 分页 */
.pagination {
  @apply flex items-center justify-center gap-4 mt-6;
}

.page-btn {
  @apply px-4 py-2 bg-white border border-gray-300 rounded-lg;
  @apply hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed;
}

.page-info {
  @apply text-sm text-gray-600;
}

.current-page {
  @apply font-bold text-blue-600;
}

/* 刷新按钮动画 */
.refresh-icon {
  @apply inline-block;
}

.refresh-icon.spinning {
  @apply animate-spin;
}
</style>