<template>
  <div class="attachment-uploader">
    <div class="uploader-header">
      <span class="uploader-title">附件上传</span>
      <span class="uploader-hint">（最多上传 {{ maxFiles }} 个附件，单个文件不超过 {{ formatFileSize(maxFileSize) }}）</span>
    </div>

    <!-- 拖拽上传区域 -->
    <el-upload
      ref="uploadRef"
      class="upload-dragger"
      :class="{ 'is-dragover': isDragover }"
      drag
      :action="uploadUrl"
      :headers="uploadHeaders"
      :before-upload="handleBeforeUpload"
      :on-success="handleUploadSuccess"
      :on-error="handleUploadError"
      :on-progress="handleUploadProgress"
      :on-remove="handleRemove"
      :file-list="fileList"
      :disabled="isUploading || fileList.length >= maxFiles"
      :accept="acceptedFileTypes.join(',')"
      multiple
      :http-request="customUpload"
    >
      <div class="upload-content">
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">
          <span class="upload-main-text">将文件拖到此处，或<span class="upload-link">点击上传</span></span>
          <span class="upload-sub-text">支持 {{ acceptedFileTypes.join('、') }} 格式</span>
        </div>
      </div>
    </el-upload>

    <!-- 上传进度列表 -->
    <div v-if="uploadingFiles.length > 0" class="uploading-list">
      <div v-for="file in uploadingFiles" :key="file.uid" class="uploading-item">
        <el-icon class="file-icon"><Document /></el-icon>
        <span class="file-name">{{ file.name }}</span>
        <el-progress
          :percentage="file.percentage"
          :status="file.percentage === 100 ? 'success' : undefined"
          :show-text="true"
          :stroke-width="4"
        />
        <el-icon class="cancel-icon" @click="cancelUpload(file)"><Close /></el-icon>
      </div>
    </div>

    <!-- 已上传文件列表 -->
    <div v-if="uploadedFiles.length > 0" class="uploaded-list">
      <div v-for="file in uploadedFiles" :key="file.uid || file.url" class="uploaded-item">
        <el-icon class="file-icon"><Document /></el-icon>
        <span class="file-name" :title="file.name">{{ file.name }}</span>
        <div class="file-actions">
          <el-tooltip content="预览" placement="top">
            <el-icon class="action-icon" @click="previewFile(file)"><View /></el-icon>
          </el-tooltip>
          <el-tooltip content="下载" placement="top">
            <el-icon class="action-icon" @click="downloadFile(file)"><Download /></el-icon>
          </el-tooltip>
          <el-tooltip content="删除" placement="top">
            <el-icon class="action-icon delete" @click="deleteFile(file)"><Delete /></el-icon>
          </el-tooltip>
        </div>
      </div>
    </div>

    <!-- 文件预览对话框 -->
    <el-dialog
      v-model="previewVisible"
      title="文件预览"
      width="60%"
      :destroy-on-close="true"
    >
      <div v-if="previewFileType === 'image'" class="preview-image-wrapper">
        <el-image
          :src="previewUrl"
          :preview-src-list="[previewUrl]"
          fit="contain"
          class="preview-image"
        />
      </div>
      <div v-else-if="previewFileType === 'pdf'" class="preview-pdf-wrapper">
        <iframe :src="previewUrl" class="preview-pdf" />
      </div>
      <div v-else class="preview-unsupported">
        <el-icon size="48"><DocumentDelete /></el-icon>
        <p>该文件类型暂不支持预览，请下载后查看</p>
        <el-button type="primary" @click="downloadCurrentFile">下载文件</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * AttachmentUploader - 资产退役申请附件上传组件
 * 
 * 功能特性：
 * - 支持拖拽上传和点击上传
 * - 文件类型校验（pdf, jpg, png, doc, docx）
 * - 文件大小校验（单文件最大 10MB）
 * - 最多上传 5 个附件
 * - 上传进度显示
 * - 文件预览与删除
 * 
 * 使用方式：
 * <AttachmentUploader
 *   v-model="attachmentList"
 *   @change="handleAttachmentsChange"
 * />
 */
import { ref, computed, watch } from 'vue'
import { ElMessage, genFileId } from 'element-plus'
import {
  UploadFilled,
  Document,
  Close,
  View,
  Download,
  Delete,
  DocumentDelete
} from '@element-plus/icons-vue'
import type { UploadFile, UploadRawFile, UploadProgressEvent } from 'element-plus'
import { retirementService } from '@/services/retirementService'

// Props 定义
interface Props {
  modelValue?: UploadFile[]
  maxFiles?: number
  maxFileSize?: number // 单位：字节
  acceptedTypes?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  maxFiles: 5,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  acceptedTypes: () => ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']
})

// Emits 定义
interface Emits {
  (e: 'update:modelValue', files: UploadFile[]): void
  (e: 'change', files: UploadFile[]): void
  (e: 'upload-start', file: File): void
  (e: 'upload-success', response: any, file: UploadFile): void
  (e: 'upload-error', error: any, file: UploadFile): void
}

const emit = defineEmits<Emits>()

// 上传配置
const uploadUrl = '/api/v1/asset-retirements/upload'
const uploadHeaders = {
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`
}

// 允许的文件类型
const acceptedFileTypes = computed(() => {
  return props.acceptedTypes.map(type => `.${type}`)
})

// 允许的 MIME 类型映射
const mimeTypeMap: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

// 状态管理
const uploadRef = ref()
const isDragover = ref(false)
const fileList = ref<UploadFile[]>([...props.modelValue])
const uploadingFiles = ref<(UploadFile & { percentage: number })[]>([])

// 计算属性：已上传文件列表
const uploadedFiles = computed(() => {
  return fileList.value.filter(file => file.status === 'success')
})

// 预览相关状态
const previewVisible = ref(false)
const previewUrl = ref('')
const previewFileType = ref<'image' | 'pdf' | 'unsupported'>('unsupported')

// 监听 modelValue 变化
watch(
  () => props.modelValue,
  (newVal) => {
    fileList.value = [...newVal]
  },
  { deep: true }
)

/**
 * 格式化文件大小显示
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 获取文件扩展名
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

/**
 * 验证文件类型
 */
function isValidFileType(file: File): boolean {
  const extension = getFileExtension(file.name)
  return props.acceptedTypes.includes(extension)
}

/**
 * 验证文件大小
 */
function isValidFileSize(file: File): boolean {
  return file.size <= props.maxFileSize
}

/**
 * 上传前校验
 */
function handleBeforeUpload(file: RawFile): boolean | Promise<boolean> {
  // 检查文件数量限制
  if (fileList.value.length >= props.maxFiles) {
    ElMessage.warning(`最多只能上传 ${props.maxFiles} 个附件`)
    return false
  }

  // 检查文件类型
  if (!isValidFileType(file)) {
    ElMessage.error(`不支持的文件格式，请上传 ${props.acceptedTypes.join('、')} 格式的文件`)
    return false
  }

  // 检查文件大小
  if (!isValidFileSize(file)) {
    ElMessage.error(`文件 ${file.name} 大小超过限制（最大 ${formatFileSize(props.maxFileSize)}）`)
    return false
  }

  emit('upload-start', file)
  return true
}

/**
 * 自定义上传方法
 */
async function customUpload(option: any) {
  const { file, onProgress, onSuccess, onError } = option
  const uploadFile = file as File & { uid?: string }

  // 添加临时 uid
  if (!uploadFile.uid) {
    (uploadFile as any).uid = genFileId()
  }

  const uploadingFile: UploadFile & { percentage: number } = {
    name: file.name,
    uid: uploadFile.uid as string,
    status: 'uploading',
    percentage: 0,
    raw: file,
    size: file.size
  }

  uploadingFiles.value.push(uploadingFile)

  try {
    // 调用服务上传文件
    const response = await retirementService.uploadAttachment(file, {
      onProgress: (percent: number) => {
        uploadingFile.percentage = percent
        onProgress({ percent } as UploadProgressEvent)
      }
    })

    // 上传成功
    uploadingFile.status = 'success'
    uploadingFile.percentage = 100
    uploadingFile.url = response.url
    uploadingFile.response = response

    // 移动到正式文件列表
    fileList.value.push({ ...uploadingFile })
    uploadingFiles.value = uploadingFiles.value.filter(f => f.uid !== uploadingFile.uid)

    // 触发更新
    updateModelValue()
    emit('upload-success', response, uploadingFile)
    onSuccess(response)

    ElMessage.success(`${file.name} 上传成功`)
  } catch (error: any) {
    // 上传失败
    uploadingFile.status = 'fail'
    uploadingFile.percentage = 0

    // 从上传中列表移除
    uploadingFiles.value = uploadingFiles.value.filter(f => f.uid !== uploadingFile.uid)

    emit('upload-error', error, uploadingFile)
    onError(error)

    ElMessage.error(`${file.name} 上传失败：${error.message || '未知错误'}`)
  }
}

/**
 * 上传成功回调
 */
function handleUploadSuccess(response: any, file: UploadFile) {
  file.url = response.url
  updateModelValue()
}

/**
 * 上传失败回调
 */
function handleUploadError(error: any, file: UploadFile) {
  ElMessage.error(`${file.name} 上传失败`)
  emit('upload-error', error, file)
}

/**
 * 上传进度回调
 */
function handleUploadProgress(event: UploadProgressEvent, file: UploadFile) {
  file.percentage = event.percent || 0
}

/**
 * 删除文件回调
 */
function handleRemove(file: UploadFile) {
  fileList.value = fileList.value.filter(f => f.uid !== file.uid)
  updateModelValue()
}

/**
 * 取消上传
 */
function cancelUpload(file: UploadFile & { percentage?: number }) {
  uploadingFiles.value = uploadingFiles.value.filter(f => f.uid !== file.uid)
  // 终止上传请求
  if (uploadRef.value) {
    const uploadInstance = uploadRef.value as any
    if (uploadInstance.abort) {
      uploadInstance.abort(file)
    }
  }
}

/**
 * 预览文件
 */
async function previewFile(file: UploadFile) {
  if (!file.url) {
    ElMessage.warning('文件地址不存在')
    return
  }

  const extension = getFileExtension(file.name)

  if (['jpg', 'jpeg', 'png'].includes(extension)) {
    previewFileType.value = 'image'
  } else if (extension === 'pdf') {
    previewFileType.value = 'pdf'
  } else {
    previewFileType.value = 'unsupported'
  }

  previewUrl.value = file.url
  previewVisible.value = true
}

/**
 * 下载文件
 */
function downloadFile(file: UploadFile) {
  if (!file.url) {
    ElMessage.warning('文件地址不存在')
    return
  }

  const link = document.createElement('a')
  link.href = file.url
  link.download = file.name
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * 下载当前预览文件
 */
function downloadCurrentFile() {
  if (previewUrl.value) {
    const link = document.createElement('a')
    link.href = previewUrl.value
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

/**
 * 删除文件
 */
async function deleteFile(file: UploadFile) {
  try {
    // 如果文件已上传到服务器，先删除服务器端文件
    if (file.url) {
      await retirementService.deleteAttachment(file.url)
    }

    // 从本地列表移除
    fileList.value = fileList.value.filter(f => (f.uid || f.url) !== (file.uid || file.url))
    updateModelValue()

    ElMessage.success('文件已删除')
  } catch (error: any) {
    ElMessage.error(`删除失败：${error.message || '未知错误'}`)
  }
}

/**
 * 更新 v-model 值
 */
function updateModelValue() {
  emit('update:modelValue', fileList.value)
  emit('change', fileList.value)
}

/**
 * 获取已上传文件的 URL 列表
 */
function getAttachmentUrls(): string[] {
  return fileList.value
    .filter(file => file.status === 'success' && file.url)
    .map(file => file.url as string)
}

/**
 * 校验附件是否已上传完成
 */
function validateAttachments(): boolean {
  const pendingFiles = fileList.value.filter(file => file.status === 'uploading')
  if (pendingFiles.length > 0) {
    ElMessage.warning('有文件正在上传中，请等待上传完成')
    return false
  }
  return true
}

// 暴露方法和属性
defineExpose({
  getAttachmentUrls,
  validateAttachments,
  uploadedFiles
})
</script>

<style scoped>
.attachment-uploader {
  width: 100%;
}

.uploader-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.uploader-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.uploader-hint {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}

/* 拖拽上传区域 */
.upload-dragger {
  width: 100%;
  height: 120px;
  border-radius: 6px;
}

.upload-dragger :deep(.el-upload-dragger) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  background-color: #fafafa;
  transition: all 0.3s;
}

.upload-dragger :deep(.el-upload-dragger:hover),
.upload-dragger.is-dragover :deep(.el-upload-dragger) {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.upload-icon {
  font-size: 32px;
  color: #909399;
  margin-bottom: 8px;
}

.upload-text {
  text-align: center;
}

.upload-main-text {
  font-size: 14px;
  color: #606266;
}

.upload-link {
  color: #409eff;
  cursor: pointer;
}

.upload-sub-text {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.upload-dragger:has(.is-disabled) {
  opacity: 0.6;
}

/* 上传中文件列表 */
.uploading-list {
  margin-top: 16px;
}

.uploading-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 8px;
}

.uploading-item .file-icon {
  font-size: 16px;
  color: #909399;
  margin-right: 8px;
}

.uploading-item .file-name {
  flex: 1;
  font-size: 13px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.uploading-item .el-progress {
  flex: 1;
  margin: 0 12px;
  max-width: 200px;
}

.uploading-item .cancel-icon {
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  transition: color 0.3s;
}

.uploading-item .cancel-icon:hover {
  color: #f56c6c;
}

/* 已上传文件列表 */
.uploaded-list {
  margin-top: 16px;
}

.uploaded-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 8px;
  transition: background-color 0.3s;
}

.uploaded-item:hover {
  background-color: #ecf5ff;
}

.uploaded-item .file-icon {
  font-size: 16px;
  color: #409eff;
  margin-right: 8px;
}

.uploaded-item .file-name {
  flex: 1;
  font-size: 13px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.file-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.3s;
}

.uploaded-item:hover .file-actions {
  opacity: 1;
}

.action-icon {
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  transition: color 0.3s;
}

.action-icon:hover {
  color: #409eff;
}

.action-icon.delete:hover {
  color: #f56c6c;
}

/* 预览对话框 */
.preview-image-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  max-height: 70vh;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
}

.preview-pdf-wrapper {
  width: 100%;
  height: 70vh;
}

.preview-pdf {
  width: 100%;
  height: 100%;
  border: none;
}

.preview-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #909399;
}

.preview-unsupported p {
  margin: 16px 0;
  font-size: 14px;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .upload-dragger {
    height: 100px;
  }

  .upload-dragger :deep(.el-upload-dragger) {
    height: 100px;
  }

  .uploading-item .file-name,
  .uploaded-item .file-name {
    max-width: 120px;
  }

  .uploading-item .el-progress {
    max-width: 120px;
  }

  .file-actions {
    opacity: 1;
  }
}
</style>