<template>
  <div class="workorder-list-page" data-testid="workorder-list-page">
    <!-- 页面标题区域 -->
    <div class="page-header">
      <h1 class="page-title">工单列表</h1>
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        新建工单
      </el-button>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <el-select
        v-model="filterStatus"
        placeholder="选择状态"
        clearable
        class="status-filter"
        data-testid="filter-status-select"
        @change="handleFilterChange"
      >
        <el-option label="全部" value="" />
        <el-option label="待审批" value="PENDING" />
        <el-option label="审批中" value="APPROVING" />
        <el-option label="已通过" value="APPROVED" />
        <el-option label="已拒绝" value="REJECTED" />
        <el-option label="已撤回" value="CANCELLED" />
      </el-select>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索工单标题"
        clearable
        class="search-input"
        data-testid="search-keyword-input"
        @input="handleSearchInput"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button @click="handleRefresh" :loading="isLoading" data-testid="refresh-btn">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading && !workorderList.length" class="loading-container">
      <el-skeleton :rows="5" animated />
    </div>

    <!-- 空状态 -->
    <div v-else-if="!workorderList.length && !isLoading" class="empty-state">
      <el-empty description="暂无工单" data-testid="empty-state">
        <template #image>
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="30" width="80" height="60" rx="4" stroke="#DCDFE6" stroke-width="2" fill="none"/>
            <line x1="30" y1="50" x2="70" y2="50" stroke="#DCDFE6" stroke-width="2"/>
            <line x1="30" y1="60" x2="90" y2="60" stroke="#DCDFE6" stroke-width="2"/>
            <line x1="30" y1="70" x2="60" y2="70" stroke="#DCDFE6" stroke-width="2"/>
          </svg>
        </template>
        <el-button type="primary" @click="handleCreate">创建第一个工单</el-button>
      </el-empty>
    </div>

    <!-- 工单列表 -->
    <div v-else class="workorder-list">
      <el-table
        :data="workorderList"
        style="width: 100%"
        v-loading="isLoading"
        @row-click="handleRowClick"
        data-testid="workorder-table"
      >
        <el-table-column prop="id" label="工单编号" width="140" />
        <el-table-column prop="title" label="工单标题" min-width="200">
          <template #default="{ row }">
            <span class="title-link" data-testid="workorder-title">{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120" align="center">
          <template #default="{ row }">
            <StatusTag :status="row.status" data-testid="status-tag" />
          </template>
        </el-table-column>
        <el-table-column prop="category" label="类别" width="120" />
        <el-table-column prop="creator" label="申请人" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="handleView(row)">
              查看
            </el-button>
            <el-button
              v-if="row.status === 'PENDING'"
              link
              type="danger"
              size="small"
              @click.stop="handleCancel(row)"
            >
              撤回
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页组件 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="totalCount"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
          data-testid="pagination"
        />
      </div>
    </div>

    <!-- 状态追踪时间轴对话框 -->
    <el-dialog
      v-model="timelineDialogVisible"
      title="审批状态追踪"
      width="600px"
      data-testid="timeline-dialog"
    >
      <WorkOrderTimeline
        v-if="selectedWorkorder"
        :workorder="selectedWorkorder"
        :timeline="approvalTimeline"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 工单列表页面组件
 * 
 * 功能：
 * - 展示工单列表，支持状态筛选和关键词搜索
 * - 实时追踪审批状态流转
 * - 分页浏览工单
 * 
 * @component
 * @example
 * <WorkOrderList />
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh } from '@element-plus/icons-vue';
import StatusTag from '@/components/workorder/StatusTag.vue';
import WorkOrderTimeline from '@/components/workorder/WorkOrderTimeline.vue';
import { useWorkOrderList } from '@/composables/useWorkOrderList';
import type { WorkOrder, WorkOrderStatus, TimelineNode } from '@/types/workorder';

/** 路由实例 */
const router = useRouter();

/** 工单列表相关逻辑 */
const {
  workorderList,
  totalCount,
  isLoading,
  currentPage,
  pageSize,
  fetchList,
  setFilter,
  setSearch
} = useWorkOrderList();

/** 筛选状态 */
const filterStatus = ref<WorkOrderStatus | ''>('');

/** 搜索关键词 */
const searchKeyword = ref('');

/** 时间轴对话框显示状态 */
const timelineDialogVisible = ref(false);

/** 选中的工单 */
const selectedWorkorder = ref<WorkOrder | null>(null);

/** 审批时间轴数据 */
const approvalTimeline = ref<TimelineNode[]>([]);

/**
 * 处理筛选状态变化
 */
const handleFilterChange = () => {
  setFilter(filterStatus.value || undefined);
  handleRefresh();
};

/**
 * 处理搜索输入（防抖）
 */
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const handleSearchInput = () => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    setSearch(searchKeyword.value);
    handleRefresh();
  }, 300);
};

/**
 * 刷新列表
 */
const handleRefresh = async () => {
  try {
    await fetchList();
  } catch (error) {
    ElMessage.error('刷新失败，请重试');
  }
};

/**
 * 新建工单
 */
const handleCreate = () => {
  router.push('/workorder/apply');
};

/**
 * 查看工单详情
 * @param row - 工单数据
 */
const handleView = (row: WorkOrder) => {
  router.push(`/workorder/detail/${row.id}`);
};

/**
 * 行点击事件
 * @param row - 工单数据
 */
const handleRowClick = (row: WorkOrder) => {
  router.push(`/workorder/detail/${row.id}`);
};

/**
 * 撤回工单
 * @param row - 工单数据
 */
const handleCancel = async (row: WorkOrder) => {
  try {
    await ElMessageBox.confirm(
      '确定要撤回该工单吗？撤回后将无法恢复。',
      '撤回确认',
      {
        confirmButtonText: '确定撤回',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    // TODO: 调用撤回接口
    ElMessage.success('工单已撤回');
    handleRefresh();
  } catch {
    // 用户取消操作
  }
};

/**
 * 分页大小变化
 * @param size - 新的分页大小
 */
const handleSizeChange = (size: number) => {
  pageSize.value = size;
  handleRefresh();
};

/**
 * 页码变化
 * @param page - 新的页码
 */
const handlePageChange = (page: number) => {
  currentPage.value = page;
  handleRefresh();
};

/**
 * 格式化日期
 * @param dateStr - 日期字符串
 * @returns 格式化后的日期
 */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 组件挂载时获取列表数据
 */
onMounted(() => {
  handleRefresh();
});
</script>

<style scoped lang="scss">
.workorder-list-page {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #303133;
    margin: 0;
  }
}

.filter-section {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  .status-filter {
    width: 160px;
  }

  .search-input {
    width: 280px;
  }
}

.loading-container {
  padding: 24px;
  background-color: #fff;
  border-radius: 8px;
}

.empty-state {
  padding: 60px 24px;
  background-color: #fff;
  border-radius: 8px;
  text-align: center;
}

.workorder-list {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  .title-link {
    color: #409eff;
    cursor: pointer;
    
    &:hover {
      text-decoration: underline;
    }
  }
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}
</style>