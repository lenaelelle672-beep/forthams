<template>
  <div class="retirement-apply-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">资产报废申请</h1>
      <p class="page-subtitle">提交资产报废请求，等待审批处理</p>
    </div>

    <!-- 报废申请表单 -->
    <el-card class="apply-form-card">
      <template #header>
        <div class="card-header">
          <span>报废申请信息</span>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="140px"
        class="retirement-form"
      >
        <!-- 资产选择 -->
        <el-form-item label="选择资产" prop="asset_id">
          <el-select
            v-model="formData.asset_id"
            placeholder="请选择要报废的资产"
            filterable
            class="asset-select"
            :disabled="isSubmitting"
            @change="handleAssetChange"
          >
            <el-option
              v-for="asset in availableAssets"
              :key="asset.id"
              :label="`${asset.name} (${asset.code})`"
              :value="asset.id"
            >
              <div class="asset-option">
                <span class="asset-name">{{ asset.name }}</span>
                <span class="asset-code">{{ asset.code }}</span>
                <span class="asset-value">账面价值: ¥{{ asset.book_value }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <!-- 资产信息展示 -->
        <div v-if="selectedAsset" class="asset-info-panel">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="资产编码">
              {{ selectedAsset.code }}
            </el-descriptions-item>
            <el-descriptions-item label="资产名称">
              {{ selectedAsset.name }}
            </el-descriptions-item>
            <el-descriptions-item label="资产类别">
              {{ selectedAsset.category }}
            </el-descriptions-item>
            <el-descriptions-item label="购置日期">
              {{ selectedAsset.purchase_date }}
            </el-descriptions-item>
            <el-descriptions-item label="账面价值">
              ¥{{ selectedAsset.book_value.toFixed(2) }}
            </el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="getStatusType(selectedAsset.status)">
                {{ getStatusLabel(selectedAsset.status) }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 报废原因 -->
        <el-form-item label="报废原因" prop="reason">
          <el-select
            v-model="formData.reason"
            placeholder="请选择报废原因"
            :disabled="isSubmitting"
          >
            <el-option label="设备老化" value="设备老化" />
            <el-option label="技术淘汰" value="技术淘汰" />
            <el-option label="损坏无法修复" value="损坏无法修复" />
            <el-option label="自然灾害" value="自然灾害" />
            <el-option label="超过使用年限" value="超过使用年限" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>

        <!-- 报废说明 -->
        <el-form-item label="报废说明" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="4"
            placeholder="请详细描述报废原因及资产当前状况"
            :disabled="isSubmitting"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <!-- 残值预估 -->
        <el-form-item label="残值预估（元）" prop="residual_value">
          <el-input-number
            v-model="formData.residual_value"
            :precision="2"
            :min="0"
            :max="999999999"
            :step="100"
            class="residual-input"
            :disabled="isSubmitting"
          />
          <span class="input-hint">请预估报废后资产的预计残值</span>
        </el-form-item>

        <!-- 附件上传 -->
        <el-form-item label="附件材料">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="5"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
            class="upload-component"
          >
            <template #trigger>
              <el-button type="primary" plain :disabled="isSubmitting">
                <el-icon><Upload /></el-icon>
                选择文件
              </el-button>
            </template>
            <template #tip>
              <div class="upload-tip">
                支持 JPG、PNG、PDF、DOC 格式，单个文件不超过 10MB，最多上传 5 个文件
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <!-- 提交按钮 -->
        <el-form-item class="form-actions">
          <el-button
            type="primary"
            :loading="isSubmitting"
            :disabled="!canSubmit"
            @click="handleSubmit"
          >
            提交申请
          </el-button>
          <el-button
            :disabled="isSubmitting"
            @click="handleSaveDraft"
          >
            保存草稿
          </el-button>
          <el-button
            :disabled="isSubmitting"
            @click="handleReset"
          >
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 提示信息 -->
    <el-alert
      v-if="showTip"
      :title="tipTitle"
      :description="tipDescription"
      :type="tipType"
      show-icon
      closable
      class="info-tip"
      @close="showTip = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 资产报废申请页面
 * 
 * 功能说明：
 * - 提供资产报废申请表单
 * - 支持资产选择、报废原因填写、残值预估
 * - 支持附件上传和草稿保存
 * - 提交后进入审批流程
 * 
 * 业务规则：
 * - 仅允许在用状态的资产发起报废申请
 * - 报废原因和说明为必填项
 * - 残值必须为非负数
 * - 提交后自动创建 RetirementApplication 记录
 * 
 * 状态流转：
 * - DRAFT（草稿）→ PENDING_APPROVAL（待审批）→ APPROVED/REJECTED → ARCHIVED
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules, type UploadInstance } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'

// 类型定义
interface Asset {
  id: string
  code: string
  name: string
  category: string
  purchase_date: string
  book_value: number
  status: 'IN_USE' | 'IDLE' | 'MAINTENANCE' | 'RETIRED'
}

interface RetirementFormData {
  asset_id: string | null
  reason: string
  description: string
  residual_value: number
  attachments: File[]
}

// 路由和状态
const router = useRouter()
const formRef = ref<FormInstance>()
const uploadRef = ref<UploadInstance>()
const isSubmitting = ref(false)

// 提示状态
const showTip = ref(false)
const tipTitle = ref('')
const tipDescription = ref('')
const tipType = ref<'success' | 'warning' | 'info' | 'error'>('info')

// 可用资产列表（仅在用状态）
const availableAssets = ref<Asset[]>([])

// 选中的资产详情
const selectedAsset = computed(() => {
  if (!formData.value.asset_id) return null
  return availableAssets.value.find(a => a.id === formData.value.asset_id) || null
})

// 表单数据
const formData = ref<RetirementFormData>({
  asset_id: null,
  reason: '',
  description: '',
  residual_value: 0,
  attachments: []
})

// 表单验证规则
const formRules: FormRules = {
  asset_id: [
    { required: true, message: '请选择要报废的资产', trigger: 'change' }
  ],
  reason: [
    { required: true, message: '请选择报废原因', trigger: 'change' }
  ],
  description: [
    { required: true, message: '请填写报废说明', trigger: 'blur' },
    { min: 10, max: 500, message: '说明长度需在 10-500 字符之间', trigger: 'blur' }
  ],
  residual_value: [
    { required: true, message: '请填写残值预估', trigger: 'blur' }
  ]
}

// 计算属性：是否可以提交
const canSubmit = computed(() => {
  return formData.value.asset_id && 
         formData.value.reason && 
         formData.value.description.length >= 10
})

/**
 * 获取状态标签
 */
const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    'IN_USE': '在用',
    'IDLE': '闲置',
    'MAINTENANCE': '维护中',
    'RETIRED': '已报废'
  }
  return statusMap[status] || status
}

/**
 * 获取状态标签类型
 */
const getStatusType = (status: string): '' | 'success' | 'warning' | 'info' | 'danger' => {
  const typeMap: Record<string, '' | 'success' | 'warning' | 'info' | 'danger'> = {
    'IN_USE': '',
    'IDLE': 'warning',
    'MAINTENANCE': 'info',
    'RETIRED': 'danger'
  }
  return typeMap[status] || ''
}

/**
 * 加载可用资产列表
 * 
 * 业务规则：
 * - 仅加载状态为 IN_USE 的资产
 * - 资产必须未被锁定（无进行中的报废单）
 */
const loadAvailableAssets = async () => {
  try {
    // TODO: 替换为实际的 API 调用
    // const response = await retirementApi.getAvailableAssets()
    // availableAssets.value = response.data
    
    // 模拟数据
    availableAssets.value = [
      {
        id: 'AST001',
        code: 'EQ-2024-001',
        name: '服务器设备-A',
        category: '电子设备',
        purchase_date: '2020-03-15',
        book_value: 85000.00,
        status: 'IN_USE'
      },
      {
        id: 'AST002',
        code: 'EQ-2024-002',
        name: '台式计算机-B',
        category: '办公设备',
        purchase_date: '2018-06-20',
        book_value: 12000.00,
        status: 'IN_USE'
      }
    ]
  } catch (error) {
    ElMessage.error('加载资产列表失败')
  }
}

/**
 * 资产选择变更处理
 * 
 * @param assetId - 选中的资产ID
 */
const handleAssetChange = (assetId: string) => {
  const asset = availableAssets.value.find(a => a.id === assetId)
  if (asset && asset.status !== 'IN_USE') {
    ElMessage.warning('仅允许对在用状态的资产发起报废申请')
    formData.value.asset_id = null
  }
}

/**
 * 文件变更处理
 * 
 * @param file - 上传的文件对象
 */
const handleFileChange = (file: any) => {
  const isValidSize = file.size / 1024 / 1024 < 10
  if (!isValidSize) {
    ElMessage.warning('单个文件大小不能超过 10MB')
    uploadRef.value?.remove(file)
    return
  }
  formData.value.attachments.push(file.raw)
}

/**
 * 文件移除处理
 * 
 * @param file - 被移除的文件对象
 */
const handleFileRemove = (file: any) => {
  const index = formData.value.attachments.findIndex(
    (f: File) => f.name === file.name
  )
  if (index > -1) {
    formData.value.attachments.splice(index, 1)
  }
}

/**
 * 提交报废申请
 * 
 * 业务流程：
 * 1. 验证表单数据
 * 2. 调用 API 创建 RetirementApplication
 * 3. 自动提交进入审批流程（DRAFT → PENDING_APPROVAL）
 * 4. 成功后跳转到历史记录页
 */
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    ElMessage.error('请完善表单信息')
    return
  }

  isSubmitting.value = true

  try {
    // TODO: 替换为实际的 API 调用
    // const response = await retirementApi.createRetirement({
    //   asset_id: formData.value.asset_id,
    //   reason: formData.value.reason,
    //   description: formData.value.description,
    //   residual_value: formData.value.residual_value,
    //   attachments: formData.value.attachments
    // })
    
    // 模拟提交
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    ElMessage.success('报废申请已提交，等待审批')
    
    // 显示提示信息
    showTip.value = true
    tipTitle.value = '提交成功'
    tipDescription.value = '您的报废申请已提交，请等待审批人员处理。您可以在报废历史记录中查看审批进度。'
    tipType.value = 'success'

    // 跳转到历史记录页
    setTimeout(() => {
      router.push('/retirement/history')
    }, 1500)
  } catch (error: any) {
    ElMessage.error(error.message || '提交失败，请重试')
  } finally {
    isSubmitting.value = false
  }
}

/**
 * 保存草稿
 * 
 * 业务流程：
 * - 不自动提交审批
 * - 状态保持为 DRAFT
 * - 可在历史记录中继续编辑
 */
const handleSaveDraft = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    ElMessage.warning('请填写必填项后再保存草稿')
    return
  }

  isSubmitting.value = true

  try {
    // TODO: 替换为实际的 API 调用
    // const response = await retirementApi.saveDraft({
    //   asset_id: formData.value.asset_id,
    //   reason: formData.value.reason,
    //   description: formData.value.description,
    //   residual_value: formData.value.residual_value
    // })
    
    // 模拟保存
    await new Promise(resolve => setTimeout(resolve, 500))
    
    ElMessage.success('草稿已保存')
    
    // 显示提示信息
    showTip.value = true
    tipTitle.value = '保存成功'
    tipDescription.value = '草稿已保存，您可以在报废历史记录中继续编辑后提交。'
    tipType.value = 'info'
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败，请重试')
  } finally {
    isSubmitting.value = false
  }
}

/**
 * 重置表单
 */
const handleReset = () => {
  formRef.value?.resetFields()
  formData.value.attachments = []
  uploadRef.value?.clearFiles()
}

/**
 * 组件挂载时加载数据
 */
onMounted(() => {
  loadAvailableAssets()
})
</script>

<style scoped>
/**
 * 资产报废申请页面样式
 * 
 * 布局说明：
 * - 页面容器使用 flex 布局，垂直排列
 * - 卡片采用白色背景，圆角边框
 * - 表单项之间保持适当间距
 */

/* 页面容器 */
.retirement-apply-container {
  padding: 24px;
  background-color: var(--bg-color-page, #f5f7fa);
  min-height: calc(100vh - 60px);
}

/* 页面标题 */
.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color-primary, #303133);
  margin: 0 0 8px 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-color-secondary, #909399);
  margin: 0;
}

/* 申请表单卡片 */
.apply-form-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.card-header {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-color-primary, #303133);
}

/* 表单样式 */
.retirement-form {
  max-width: 800px;
  padding: 20px 0;
}

.asset-select {
  width: 100%;
  max-width: 400px;
}

/* 资产选项样式 */
.asset-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.asset-option .asset-name {
  font-weight: 500;
  color: var(--text-color-primary, #303133);
}

.asset-option .asset-code {
  font-size: 12px;
  color: var(--text-color-secondary, #909399);
  margin-left: 12px;
}

.asset-option .asset-value {
  font-size: 12px;
  color: var(--color-primary, #409eff);
}

/* 资产信息面板 */
.asset-info-panel {
  margin: 20px 0;
  padding: 16px;
  background: var(--bg-color-container, #fafafa);
  border-radius: 6px;
  border: 1px solid var(--border-color-light, #ebeef5);
}

/* 残值输入 */
.residual-input {
  width: 200px;
}

.input-hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-color-secondary, #909399);
}

/* 上传组件 */
.upload-component {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-tip {
  font-size: 12px;
  color: var(--text-color-secondary, #909399);
  margin-top: 8px;
}

/* 表单操作按钮 */
.form-actions {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color-light, #ebeef5);
}

.form-actions .el-button {
  min-width: 100px;
  margin-right: 12px;
}

/* 提示信息 */
.info-tip {
  margin-top: 24px;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .retirement-apply-container {
    padding: 16px;
  }

  .retirement-form {
    max-width: 100%;
  }

  .form-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-actions .el-button {
    width: 100%;
    margin-right: 0;
  }

  .asset-info-panel :deep(.el-descriptions) {
    font-size: 12px;
  }
}
</style>