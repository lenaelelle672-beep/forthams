<template>
  <div class="approval-list-view">
    <div class="page-header">
      <h1 class="page-title">审批列表</h1>
      <div class="header-actions">
        <el-button type="primary" @click="handleRefresh">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-container">
      <el-skeleton :rows="6" animated />
    </div>

    <!-- 错误状态 -->
    <el-result
      v-else-if="errorState"
      class="error-alert"
      icon="error"
      title="加载失败"
      :sub-title="errorState.message || '获取审批列表失败，请重试'"
    >
      <template #extra>
        <el-button type="primary" @click="handleRetry">重试</el-button>
      </template>
    </el-result>

    <!-- 审批列表内容 -->
    <div v-else class="list-content">
      <!-- 筛选器 -->
      <ApprovalFilter
        v-model:status="filterStatus"
        v-model:search="searchKeyword"
        @filter-change="handleFilterChange"
      />

      <!-- 空状态 -->
      <el-empty
        v-if="filteredList.length === 0"
        class="empty-state"
        description="暂无审批记录"
      >
        <el-button type="primary" @click="handleCreateNew">创建新审批</el-button>
      </el-empty>

      <!-- 审批列表 -->
      <div v-else class="approval-items">
        <TransitionGroup name="list">
          <ApprovalListItem
            v-for="item in paginatedList"
            :key="item.id"
            :approval="item"
            :is-pending="isOperationPending(item.id)"
            @click="handleItemClick(item)"
            @approve="handleApprove(item)"
            @reject="handleReject(item)"
          />
        </TransitionGroup>
      </div>

      <!-- 分页器 -->
      <div v-if="filteredList.length > 0" class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="filteredList.length"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 审批详情抽屉 -->
    <el-drawer
      v-model="detailDrawerVisible"
      title="审批详情"
      size="600px"
      :before-close="handleDrawerClose"
    >
      <ApprovalDetailView
        v-if="currentApproval"
        :approval="currentApproval"
        :is-loading="detailLoading"
        @close="handleDrawerClose"
        @action="handleApprovalAction"
      />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
/**
 * ApprovalListView - 审批列表视图组件
 * 
 * 职责：
 * - 展示审批列表数据
 * - 实现与 ApprovalService 的双向绑定
 * - 处理列表筛选、分页、操作等用户交互
 * 
 * 绑定关系：
 * - approvalList: 绑定 store.approvalList（列表数据）
 * - isLoading: 绑定 store.loadingState.isLoading
 * - errorState: 绑定 store.errorState
 * - currentApproval: 绑定 store.currentApproval
 * - pendingOperations: 绑定 store.pendingOperations
 */
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { useApprovalStore } from '@/stores/approvalStore';
import type { Approval, ApprovalStatus } from '@/types/approval';
import ApprovalFilter from '@/components/approval/ApprovalFilter.vue';
import ApprovalListItem from '@/components/approval/ApprovalListItem.vue';
import ApprovalDetailView from './ApprovalDetailView.vue';

// Store 实例
const approvalStore = useApprovalStore();

// 响应式状态
const filterStatus = ref<ApprovalStatus | ''>('');
const searchKeyword = ref('');
const currentPage = ref(1);
const pageSize = ref(10);
const detailDrawerVisible = ref(false);
const detailLoading = ref(false);

// 从 store 获取完整列表
const approvalList = computed(() => approvalStore.approvalList ?? []);

// 双向绑定计算属性（空值安全）
const isLoading = computed(() => approvalStore.loadingState?.isLoading ?? false);
const errorState = computed(() => approvalStore.errorState ?? null);
const currentApproval = computed(() => approvalStore.currentApproval ?? null);

// 过滤后的列表
const filteredList = computed(() => {
  let list = approvalStore.approvalList;
  
  // 状态筛选
  if (filterStatus.value) {
    list = list.filter(item => item.status === filterStatus.value);
  }
  
  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    list = list.filter(item => 
      item.title?.toLowerCase().includes(keyword) ||
      item.applicantName?.toLowerCase().includes(keyword) ||
      item.applicantDept?.toLowerCase().includes(keyword)
    );
  }
  
  return list;
});

// 分页后的列表
const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredList.value.slice(start, end);
});

// 检查操作是否处于待处理状态
function isOperationPending(id: string): boolean {
  return approvalStore.pendingOperations.has(id);
}

/**
 * 加载审批列表数据（统一入口）
 */
async function loadApprovalList() {
  try {
    await approvalStore.fetchApprovalList({
      page: currentPage.value,
      pageSize: pageSize.value
    });
  } catch (error) {
    console.error('加载审批列表失败:', error);
  }
}

/**
 * 刷新审批列表
 */
async function handleRefresh() {
  await loadApprovalList();
  if (!errorState.value) {
    ElMessage.success('刷新成功');
  }
}

/**
 * 重试失败操作
 */
function handleRetry() {
  handleRefresh();
}

/**
 * 筛选条件变更处理
 */
function handleFilterChange() {
  currentPage.value = 1; // 重置页码
  // 筛选变更后，Service 层状态已通过 computed 属性自动同步
}

/**
 * 分页大小变更处理
 */
function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
}

/**
 * 页码变更处理
 */
function handlePageChange(page: number) {
  currentPage.value = page;
}

/**
 * 点击审批项 - 查看详情
 */
async function handleItemClick(item: Approval) {
  detailDrawerVisible.value = true;
  detailLoading.value = true;
  
  try {
    await approvalStore.getApprovalDetail(item.id);
  } catch (error) {
    ElMessage.error('获取详情失败');
    detailDrawerVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

/**
 * 关闭详情抽屉
 */
function handleDrawerClose() {
  detailDrawerVisible.value = false;
  approvalStore.clearCurrentApproval();
}

/**
 * 审批通过操作
 * 实现双向绑定：UI 操作触发 Service 更新
 */
async function handleApprove(item: Approval) {
  try {
    await ElMessageBox.confirm(
      '确认通过该审批申请？',
      '审批确认',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    await approvalStore.updateApprovalStatus(item.id, 'APPROVED');
    
    ElMessage.success('审批已通过');
    await loadApprovalList();
    
    if (detailDrawerVisible.value && currentApproval.value?.id === item.id) {
      await approvalStore.getApprovalDetail(item.id);
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '操作失败');
    }
  }
}

/**
 * 审批驳回操作
 */
async function handleReject(item: Approval) {
  try {
    const { value: reason } = await ElMessageBox.prompt(
      '请输入驳回原因：',
      '审批驳回',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputValidator: (value) => {
          if (!value || value.trim().length === 0) {
            return '请输入驳回原因';
          }
          return true;
        }
      }
    );
    
    await approvalStore.updateApprovalStatus(item.id, 'REJECTED', { reason });
    
    ElMessage.success('已驳回申请');
    
    if (detailDrawerVisible.value && currentApproval.value?.id === item.id) {
      await approvalStore.getApprovalDetail(item.id);
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '操作失败');
    }
  }
}

/**
 * 审批操作处理（来自详情页）
 */
async function handleApprovalAction(data: { status: ApprovalStatus; comment?: string }) {
  if (!currentApproval.value) return;
  
  try {
    await approvalStore.updateApprovalStatus(
      currentApproval.value.id,
      data.status,
      { comment: data.comment }
    );
    
    ElMessage.success(`审批${data.status === 'APPROVED' ? '通过' : '驳回'}成功`);
    handleDrawerClose();
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败');
  }
}

/**
 * 创建新审批
 */
function handleCreateNew() {
  // 导航至审批创建页面
  // router.push('/approval/create');
  ElMessage.info('创建功能开发中');
}

// 监听筛选条件变化，自动同步至 Store（如需要持久化）
watch([filterStatus, searchKeyword], () => {
  handleFilterChange();
}, { immediate: false });

// 组件挂载时获取数据
onMounted(async () => {
  await handleRefresh();
});
</script>

<style scoped>
.approval-list-view {
  padding: 24px;
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.loading-container {
  padding: 24px;
  background: var(--el-bg-color);
  border-radius: 8px;
}

.error-alert {
  margin: 24px 0;
}

.list-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  padding: 48px 0;
  background: var(--el-bg-color);
  border-radius: 8px;
}

.approval-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0;
  background: var(--el-bg-color);
  border-radius: 8px;
}

/* 列表过渡动画 */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.list-move {
  transition: transform 0.3s ease;
}
</style>