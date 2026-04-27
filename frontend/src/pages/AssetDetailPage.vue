<template>
  <div class="asset-detail-page">
    <div class="page-header">
      <h1>资产详情</h1>
      <div class="header-actions">
        <button @click="goBack" class="btn-back">返回</button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
      <button @click="loadAsset">重试</button>
    </div>

    <div v-else-if="asset" class="asset-content">
      <div class="asset-main">
        <section class="asset-section">
          <h2>基本信息</h2>
          <div class="info-grid">
            <div class="info-item">
              <label>资产编号</label>
              <span>{{ asset.asset_number }}</span>
            </div>
            <div class="info-item">
              <label>资产名称</label>
              <span>{{ asset.name }}</span>
            </div>
            <div class="info-item">
              <label>资产类别</label>
              <span>{{ asset.category }}</span>
            </div>
            <div class="info-item">
              <label>规格型号</label>
              <span>{{ asset.specification || '-' }}</span>
            </div>
            <div class="info-item">
              <label>使用部门</label>
              <span>{{ asset.department || '-' }}</span>
            </div>
            <div class="info-item">
              <label>使用人</label>
              <span>{{ asset.user || '-' }}</span>
            </div>
            <div class="info-item">
              <label>购置日期</label>
              <span>{{ formatDate(asset.purchase_date) }}</span>
            </div>
            <div class="info-item">
              <label>资产原值</label>
              <span>{{ formatCurrency(asset.original_value) }}</span>
            </div>
            <div class="info-item">
              <label>累计折旧</label>
              <span>{{ formatCurrency(asset.accumulated_depreciation) }}</span>
            </div>
            <div class="info-item">
              <label>资产净值</label>
              <span class="highlight">{{ formatCurrency(asset.net_value) }}</span>
            </div>
            <div class="info-item">
              <label>资产状态</label>
              <span :class="['status-badge', `status-${asset.status}`]">
                {{ asset.status }}
              </span>
            </div>
            <div class="info-item">
              <label>存放地点</label>
              <span>{{ asset.location || '-' }}</span>
            </div>
          </div>
        </section>

        <section class="asset-section">
          <h2>折旧信息</h2>
          <div class="info-grid">
            <div class="info-item">
              <label>折旧方法</label>
              <span>{{ asset.depreciation_method || '直线法' }}</span>
            </div>
            <div class="info-item">
              <label>折旧年限</label>
              <span>{{ asset.depreciation_years }} 年</span>
            </div>
            <div class="info-item">
              <label>已折旧月数</label>
              <span>{{ asset.depreciation_months }} 个月</span>
            </div>
            <div class="info-item">
              <label>残值率</label>
              <span>{{ (asset.salvage_rate * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </section>

        <section class="asset-section">
          <h2>扩展信息</h2>
          <div class="info-grid">
            <div class="info-item">
              <label>供应商</label>
              <span>{{ asset.vendor || '-' }}</span>
            </div>
            <div class="info-item">
              <label>供应商联系人</label>
              <span>{{ asset.vendor_contact || '-' }}</span>
            </div>
            <div class="info-item">
              <label>供应商电话</label>
              <span>{{ asset.vendor_phone || '-' }}</span>
            </div>
            <div class="info-item">
              <label>维保到期</label>
              <span>{{ asset.warranty_expiry ? formatDate(asset.warranty_expiry) : '-' }}</span>
            </div>
            <div class="info-item full-width">
              <label>备注</label>
              <span>{{ asset.remarks || '-' }}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="asset-sidebar">
        <section class="sidebar-section">
          <h3>操作</h3>
          <div class="action-buttons">
            <button 
              v-if="canEdit" 
              @click="editAsset" 
              class="btn-action"
            >
              编辑信息
            </button>
            <button 
              v-if="canTransfer" 
              @click="transferAsset" 
              class="btn-action"
            >
              资产调拨
            </button>
            <button 
              v-if="canRetire" 
              @click="showRetirementDialog" 
              class="btn-action btn-retire"
            >
              报废申请
            </button>
            <button 
              v-if="canMaintenance" 
              @click="createMaintenance" 
              class="btn-action"
            >
              发起维修
            </button>
          </div>
        </section>

        <section class="sidebar-section">
          <h3>资产图片</h3>
          <div class="asset-image-container">
            <img 
              v-if="asset.image_url" 
              :src="asset.image_url" 
              :alt="asset.name"
              class="asset-image"
            />
            <div v-else class="no-image">
              <span>暂无图片</span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 生命周期时间轴 -->
    <LifecycleTimeline 
      v-if="asset && !loading"
      :asset-id="assetId"
      :order="timelineOrder"
      @toggle-order="toggleTimelineOrder"
      @event-click="onTimelineEventClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { AssetDetail, TimelineEvent } from '@/types/asset.types';
import LifecycleTimeline from '@/components/LifecycleTimeline.vue';

/**
 * AssetDetailPage Component
 * 
 * 资产详情页 - 展示资产完整信息及生命周期历史
 * 
 * @description 
 * - 显示资产的基本信息、折旧信息、扩展信息
 * - 集成生命周期时间轴组件，展示状态变更历史
 * - 支持时间倒序/正序切换查看
 * 
 * @features
 * - 生命周期历史记录可视化
 * - 状态变更时间轴展示
 * - 审批流程历史追溯
 */
interface Props {
  assetId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  assetId: ''
});

const route = useRoute();
const router = useRouter();

const asset = ref<AssetDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const timelineOrder = ref<'desc' | 'asc'>('desc');

const resolvedAssetId = computed(() => {
  return props.assetId || (route.params.id as string) || '';
});

/**
 * 加载资产详情
 */
const loadAsset = async () => {
  if (!resolvedAssetId.value) {
    error.value = '缺少资产ID参数';
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // 模拟 API 调用
    const response = await fetch(`/api/v1/assets/${resolvedAssetId.value}`);
    if (!response.ok) {
      throw new Error(`加载失败: ${response.status}`);
    }
    asset.value = await response.json();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载资产详情失败';
    // 使用模拟数据用于演示
    asset.value = getMockAsset(resolvedAssetId.value);
  } finally {
    loading.value = false;
  }
};

/**
 * 获取模拟资产数据
 */
const getMockAsset = (id: string): AssetDetail => {
  return {
    id: id,
    asset_number: `AST-${id.padStart(6, '0')}`,
    name: '测试资产',
    category: '电子设备',
    specification: 'ThinkPad X1 Carbon',
    department: '技术部',
    user: '张三',
    purchase_date: '2024-01-15',
    original_value: 12000,
    accumulated_depreciation: 2400,
    net_value: 9600,
    status: '可用',
    location: 'A栋301',
    depreciation_method: '直线法',
    depreciation_years: 5,
    depreciation_months: 12,
    salvage_rate: 0.05,
    vendor: '联想官方旗舰店',
    vendor_contact: '李四',
    vendor_phone: '400-100-1234',
    warranty_expiry: '2027-01-15',
    remarks: '2024年采购，用于开发工作',
    image_url: null,
  };
};

/**
 * 格式化日期
 */
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN');
};

/**
 * 格式化货币
 */
const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return '-';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
};

/**
 * 返回列表页
 */
const goBack = () => {
  router.push('/assets');
};

/**
 * 编辑资产
 */
const editAsset = () => {
  router.push(`/assets/${resolvedAssetId.value}/edit`);
};

/**
 * 资产调拨
 */
const transferAsset = () => {
  router.push(`/assets/${resolvedAssetId.value}/transfer`);
};

/**
 * 显示报废申请对话框
 */
const showRetirementDialog = () => {
  router.push(`/assets/${resolvedAssetId.value}/retire`);
};

/**
 * 创建维修工单
 */
const createMaintenance = () => {
  router.push(`/assets/${resolvedAssetId.value}/maintenance`);
};

/**
 * 切换时间轴排序
 */
const toggleTimelineOrder = () => {
  timelineOrder.value = timelineOrder.value === 'desc' ? 'asc' : 'desc';
};

/**
 * 时间轴事件点击处理
 */
const onTimelineEventClick = (event: TimelineEvent) => {
  // 根据事件类型导航到相关详情页
  if (event.event_type === '报废申请') {
    router.push(`/retirement/${event.reference_id}`);
  } else if (event.event_type === '维修') {
    router.push(`/workorders/${event.reference_id}`);
  }
};

/**
 * 操作权限判断
 */
const canEdit = computed(() => {
  return asset.value && asset.value.status === '可用';
});

const canTransfer = computed(() => {
  return asset.value && asset.value.status === '可用';
});

const canRetire = computed(() => {
  return asset.value && 
         ['可用', '维修中'].includes(asset.value.status);
});

const canMaintenance = computed(() => {
  return asset.value && asset.value.status !== '已报废' && asset.value.status !== '已退役';
});

onMounted(() => {
  loadAsset();
});

watch(() => resolvedAssetId.value, () => {
  loadAsset();
});
</script>

<style scoped>
.asset-detail-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-back {
  padding: 8px 16px;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-container button {
  margin-top: 16px;
  padding: 8px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.asset-content {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
}

.asset-main {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.asset-section {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.asset-section h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-item label {
  font-size: 14px;
  color: #6b7280;
}

.info-item span {
  font-size: 14px;
  color: #1f2937;
}

.info-item .highlight {
  color: #3b82f6;
  font-weight: 600;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
}

.status-可用 { background: #dcfce7; color: #166534; }
.status-维修中 { background: #fef3c7; color: #92400e; }
.status-审批中 { background: #dbeafe; color: #1e40af; }
.status-已报废 { background: #fee2e2; color: #991b1b; }
.status-已退役 { background: #f3f4f6; color: #4b5563; }

.asset-sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.sidebar-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.sidebar-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-action {
  padding: 12px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-action:hover {
  background: #2563eb;
}

.btn-action.btn-retire {
  background: #dc2626;
}

.btn-action.btn-retire:hover {
  background: #b91c1c;
}

.asset-image-container {
  width: 100%;
  aspect-ratio: 4/3;
  background: #f3f4f6;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.asset-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-image {
  color: #9ca3af;
  font-size: 14px;
}

@media (max-width: 1024px) {
  .asset-content {
    grid-template-columns: 1fr;
  }

  .asset-sidebar {
    order: -1;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .sidebar-section {
    flex: 1;
    min-width: 280px;
  }
}
</style>