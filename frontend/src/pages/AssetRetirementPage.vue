<template>
  <div class="asset-retirement-page">
    <el-card class="retirement-card">
      <template #header>
        <div class="card-header">
          <h1>资产退役申请</h1>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="140px"
        class="retirement-form"
      >
        <!-- 资产信息区域 -->
        <div class="asset-info-section">
          <h3>设备信息</h3>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="资产名称">
                <el-input v-model="assetInfo.name" disabled />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="资产编号">
                <el-input v-model="assetInfo.code" disabled />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="规格型号">
                <el-input v-model="assetInfo.specification" disabled />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="购置日期">
                <el-input v-model="assetInfo.purchaseDate" disabled />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="当前状态">
                <el-input v-model="assetInfo.status" disabled />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="所属部门">
                <el-input v-model="assetInfo.department" disabled />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 退役原因选择 -->
        <el-form-item label="退役原因" prop="reason" class="reason-item">
          <el-select
            v-model="formData.reason"
            placeholder="请选择退役原因"
            class="reason-select"
            @change="handleReasonChange"
          >
            <el-option
              v-for="reason in reasonOptions"
              :key="reason.value"
              :label="reason.label"
              :value="reason.value"
            />
          </el-select>
        </el-form-item>

        <!-- 补充说明 -->
        <el-form-item label="补充说明" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="4"
            placeholder="请输入补充说明（可选）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <!-- 附件上传区域 -->
        <div class="attachment-section">
          <h3>附件上传</h3>
          <p class="attachment-hint">单文件最大 10MB，支持格式：pdf, jpg, png, doc, docx，最多上传 5 个附件</p>
          <el-upload
            ref="uploadRef"
            class="attachment-uploader"
            :auto-upload="false"
            :limit="5"
            :on-exceed="handleExceed"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :before-remove="handleBeforeRemove"
            accept=".pdf,.jpg,.png,.doc,.docx"
            multiple
            drag
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              拖拽文件到此处或 <em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                已上传 {{ fileList.length }} / 5 个文件
              </div>
            </template>
          </el-upload>
        </div>

        <!-- 提交按钮 -->
        <div class="form-actions">
          <el-button @click="handleCancel">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            提交申请
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadInstance, type UploadRawFile, type FileList } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { retirementService } from '@/services/retirementService'
import { assetService } from '@/services/assetService'
import type { RetirementReason } from '@/types/retirement.types'

// 退役原因枚举
const RETIREMENT_REASONS = {
  EQUIPMENT_FAILURE: '设备故障无法修复',
  UPGRADE_REPLACEMENT: '升级换代淘汰',
  EXPIRED_LIFECYCLE: '超过使用年限',
  DAMAGE_LOSS: '损坏或丢失',
  OTHER: '其他原因'
}

const reasonOptions = Object.entries(RETIREMENT_REASONS).map(([value, label]) => ({
  value,
  label
}))

const route = useRoute()
const router = useRouter()
const formRef = ref<FormInstance>()
const uploadRef = ref<UploadInstance>()

const submitting = ref(false)
const fileList = ref<FileList>([])
const assetId = ref<string>('')

// 资产信息（只读）
const assetInfo = reactive({
  name: '',
  code: '',
  specification: '',
  purchaseDate: '',
  status: '',
  department: ''
})

// 表单数据
const formData = reactive({
  reason: '' as RetirementReason | '',
  description: ''
})

// 表单校验规则
const formRules: FormRules = {
  reason: [
    { required: true, message: '请选择退役原因', trigger: 'change' }
  ]
}

// 文件大小限制 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']

// 获取资产详情
const loadAssetInfo = async (id: string) => {
  try {
    const asset = await assetService.getAssetById(id)
    assetInfo.name = asset.name || ''
    assetInfo.code = asset.code || ''
    assetInfo.specification = asset.specification || asset.modelNumber || ''
    assetInfo.purchaseDate = asset.purchaseDate ? formatDate(asset.purchaseDate) : ''
    assetInfo.status = asset.status || ''
    assetInfo.department = asset.department || ''
  } catch (error) {
    ElMessage.error('加载资产信息失败')
    console.error('Failed to load asset info:', error)
  }
}

// 格式化日期
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

// 验证文件
const validateFile = (file: File): boolean => {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    ElMessage.error(`${file.name} 文件格式不支持`)
    return false
  }
  if (file.size > MAX_FILE_SIZE) {
    ElMessage.error(`${file.name} 文件大小超过限制（最大 10MB）`)
    return false
  }
  return true
}

// 文件数量超限处理
const handleExceed = () => {
  ElMessage.warning('最多只能上传 5 个附件')
}

// 文件变化处理
const handleFileChange = (file: { raw: UploadRawFile }) => {
  if (file.raw) {
    if (!validateFile(file.raw)) {
      uploadRef.value?.handleRemove(file.raw)
      return
    }
    fileList.value.push(file as unknown as FileList[number])
  }
}

// 移除文件前检查
const handleBeforeRemove = () => {
  return true
}

// 文件移除处理
const handleFileRemove = (file: FileList[number]) => {
  const index = fileList.value.indexOf(file)
  if (index > -1) {
    fileList.value.splice(index, 1)
  }
}

// 退役原因变化处理
const handleReasonChange = (value: RetirementReason) => {
  formData.reason = value
}

// 提交申请
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.error('请完善表单信息')
      return
    }

    if (fileList.value.length === 0) {
      const confirmed = await ElMessageBox.confirm(
        '尚未上传附件，是否继续提交？',
        '提示',
        { confirmButtonText: '继续提交', cancelButtonText: '取消', type: 'warning' }
      ).catch(() => false)
      if (!confirmed) return
    }

    submitting.value = true
    try {
      // 上传附件
      const attachmentUrls: string[] = []
      for (const file of fileList.value) {
        const formDataUpload = new FormData()
        formDataUpload.append('file', file.raw)
        const result = await retirementService.uploadRetirementAttachment(formDataUpload)
        attachmentUrls.push(result.url)
      }

      // 创建退役申请
      const retirementData = {
        assetId: assetId.value,
        reason: formData.reason as RetirementReason,
        description: formData.description,
        attachmentUrls
      }

      await retirementService.createRetirementApplication(retirementData)
      ElMessage.success('退役申请提交成功')
      router.push({ name: 'AssetRetirementList' })
    } catch (error) {
      ElMessage.error('提交失败，请重试')
      console.error('Failed to submit retirement application:', error)
    } finally {
      submitting.value = false
    }
  })
}

// 取消操作
const handleCancel = async () => {
  const confirmed = await ElMessageBox.confirm(
    '确定要取消吗？未保存的内容将丢失',
    '提示',
    { confirmButtonText: '确定', cancelButtonText: '继续填写', type: 'warning' }
  ).catch(() => false)

  if (confirmed) {
    router.push({ name: 'AssetList' })
  }
}

// 组件挂载时加载资产信息
onMounted(() => {
  const id = route.query.assetId as string
  if (id) {
    assetId.value = id
    loadAssetInfo(id)
  } else {
    ElMessage.error('缺少资产ID参数')
    router.push({ name: 'AssetList' })
  }
})
</script>

<style scoped>
.asset-retirement-page {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.retirement-card {
  max-width: 900px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.retirement-form {
  margin-top: 20px;
}

.asset-info-section {
  background-color: #f5f7fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.asset-info-section h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
  border-left: 3px solid #409eff;
  padding-left: 10px;
}

.asset-info-section :deep(.el-input.is-disabled .el-input__inner) {
  color: #606266;
  background-color: #f0f2f5;
  cursor: not-allowed;
}

.reason-item {
  margin-top: 20px;
}

.reason-select {
  width: 100%;
  max-width: 400px;
}

.attachment-section {
  margin-top: 30px;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.attachment-section h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
  border-left: 3px solid #409eff;
  padding-left: 10px;
}

.attachment-hint {
  margin: 0 0 15px 0;
  font-size: 12px;
  color: #909399;
}

.attachment-uploader {
  width: 100%;
}

.attachment-uploader :deep(.el-upload-dragger) {
  padding: 30px;
}

.attachment-uploader :deep(.el-icon--upload) {
  font-size: 67px;
  color: #c0c4cc;
  margin-bottom: 16px;
}

.form-actions {
  margin-top: 30px;
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.form-actions .el-button {
  min-width: 100px;
  margin: 0 10px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}

:deep(.el-upload__tip) {
  margin-top: 8px;
  color: #909399;
}
</style>