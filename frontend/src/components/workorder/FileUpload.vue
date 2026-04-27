<script lang="ts" setup>
/**
 * FileUpload.vue
 * 工单附件上传组件（L3 组件层 — TASK-303）
 *
 * 功能：
 *   - 选择并上传工单附件（支持单次多选）
 *   - 展示已上传文件列表（文件名 + 格式化文件大小）
 *   - 提供删除单个附件的交互
 *   - 通过 v-model:files 向父组件同步文件列表
 *   - 上传中展示进度状态，失败时提示错误
 *
 * ATB 覆盖：
 *   - ATB-005: 附件上传成功 → 显示文件列表，包含文件名和大小
 *
 * 使用示例：
 *   <FileUpload v-model:files="attachments" :max-size-mb="10" :accept="'.pdf,.png,.jpg'" />
 */

import { ref, computed } from 'vue'
import {
  ElUpload,
  ElButton,
  ElIcon,
  ElProgress,
  ElMessage,
  type UploadFile,
  type UploadRawFile,
  type UploadRequestOptions,
} from 'element-plus'
import { UploadFilled, Delete, Document, Loading } from '@element-plus/icons-vue'

// ─── Props ────────────────────────────────────────────────────────────────────

interface UploadedFile {
  /** 唯一标识（前端生成 uid 或服务端返回 id） */
  uid: string
  /** 原始文件名 */
  name: string
  /** 文件字节数 */
  size: number
  /** 上传后服务端返回的访问 URL（上传成功后填充） */
  url?: string
  /** 上传状态 */
  status: 'uploading' | 'success' | 'error'
  /** 上传进度 0-100 */
  percent: number
  /** 错误信息（status === 'error' 时填充） */
  errorMessage?: string
}

interface Props {
  /** 已上传文件列表（v-model:files 双向绑定） */
  files?: UploadedFile[]
  /** 单文件最大尺寸（MB），默认 20 */
  maxSizeMb?: number
  /** 接受的 MIME 类型或后缀，默认不限制 */
  accept?: string
  /** 最多可上传文件数量，默认 10 */
  limit?: number
  /** 是否禁用上传（审批后只读） */
  disabled?: boolean
  /** 自定义上传接口路径 */
  action?: string
}

const props = withDefaults(defineProps<Props>(), {
  files: () => [],
  maxSizeMb: 20,
  accept: '',
  limit: 10,
  disabled: false,
  action: '/api/workorder/attachments',
})

// ─── Emits ───────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  /** 文件列表变化时通知父组件 */
  (e: 'update:files', files: UploadedFile[]): void
  /** 单文件上传成功 */
  (e: 'upload-success', file: UploadedFile): void
  /** 单文件上传失败 */
  (e: 'upload-error', file: UploadedFile, error: Error): void
}>()

// ─── 内部状态 ─────────────────────────────────────────────────────────────────

/** 内部维护的文件列表副本，与父组件通过 emit 同步 */
const innerFiles = ref<UploadedFile[]>([...props.files])

/** 是否已达到文件数量上限 */
const isLimitReached = computed<boolean>(
  () => innerFiles.value.length >= props.limit
)

/** 格式化文件大小：bytes → 人类可读字符串 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = (bytes / Math.pow(1024, exp)).toFixed(exp === 0 ? 0 : 1)
  return `${value} ${units[exp]}`
}

// ─── 上传前校验 ───────────────────────────────────────────────────────────────

/**
 * el-upload beforeUpload 钩子：校验文件大小，阻止超限文件。
 * @param rawFile - 原始 File 对象
 * @returns 校验通过返回 true，否则返回 false 并弹出提示
 */
function handleBeforeUpload(rawFile: UploadRawFile): boolean {
  const maxBytes = props.maxSizeMb * 1024 * 1024

  if (rawFile.size > maxBytes) {
    ElMessage.error(`文件「${rawFile.name}」超过大小限制（最大 ${props.maxSizeMb} MB）`)
    return false
  }

  if (isLimitReached.value) {
    ElMessage.warning(`最多只能上传 ${props.limit} 个附件`)
    return false
  }

  return true
}

// ─── 上传逻辑 ─────────────────────────────────────────────────────────────────

/**
 * 自定义上传请求：使用 fetch 替代 el-upload 默认 XHR，
 * 便于统一请求拦截（Token 注入、响应规范化）。
 * @param options - el-upload 提供的上传配置项
 */
async function handleHttpRequest(options: UploadRequestOptions): Promise<void> {
  const { file, onProgress, onSuccess, onError } = options

  // 先在列表中占位，显示上传中状态
  const pendingEntry: UploadedFile = {
    uid: (file as UploadRawFile).uid?.toString() ?? String(Date.now()),
    name: file.name,
    size: file.size,
    status: 'uploading',
    percent: 0,
  }
  innerFiles.value.push(pendingEntry)
  syncToParent()

  const formData = new FormData()
  formData.append('file', file)

  try {
    // 使用 XHR 以支持进度事件
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          updateFile(pendingEntry.uid, { percent })
          onProgress({ percent } as ProgressEvent & { percent: number })
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let responseData: { url?: string } = {}
          try {
            const parsed = JSON.parse(xhr.responseText)
            responseData = parsed?.data ?? parsed
          } catch {
            // 非 JSON 响应时忽略
          }
          updateFile(pendingEntry.uid, {
            status: 'success',
            percent: 100,
            url: responseData.url,
          })
          const successEntry = getFile(pendingEntry.uid)!
          onSuccess(responseData)
          emit('upload-success', successEntry)
          syncToParent()
          resolve()
        } else {
          reject(new Error(`上传失败，服务器返回 ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('网络错误，请检查连接后重试'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('上传已取消'))
      })

      // 从本地存储或 cookie 中读取 Token（对齐 src/utils/http.ts 约定）
      const token = localStorage.getItem('access_token') ?? ''

      xhr.open('POST', props.action)
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }
      xhr.send(formData)
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    updateFile(pendingEntry.uid, {
      status: 'error',
      errorMessage: error.message,
    })
    const errorEntry = getFile(pendingEntry.uid)!
    onError(error as Parameters<typeof onError>[0])
    emit('upload-error', errorEntry, error)
    ElMessage.error(`「${file.name}」上传失败：${error.message}`)
    syncToParent()
  }
}

// ─── 文件列表操作 ─────────────────────────────────────────────────────────────

/**
 * 获取指定 uid 的文件条目。
 * @param uid - 文件唯一标识
 */
function getFile(uid: string): UploadedFile | undefined {
  return innerFiles.value.find((f) => f.uid === uid)
}

/**
 * 局部更新文件条目的字段。
 * @param uid - 文件唯一标识
 * @param patch - 需要合并更新的字段
 */
function updateFile(uid: string, patch: Partial<UploadedFile>): void {
  const idx = innerFiles.value.findIndex((f) => f.uid === uid)
  if (idx !== -1) {
    innerFiles.value[idx] = { ...innerFiles.value[idx], ...patch }
  }
}

/**
 * 从文件列表中移除指定附件并通知父组件。
 * @param uid - 待移除文件的唯一标识
 */
function removeFile(uid: string): void {
  innerFiles.value = innerFiles.value.filter((f) => f.uid !== uid)
  syncToParent()
}

/**
 * 将当前内部文件列表同步给父组件（触发 v-model:files 更新）。
 */
function syncToParent(): void {
  emit('update:files', [...innerFiles.value])
}

// ─── el-upload 事件（仅用于超限提示） ────────────────────────────────────────

/**
 * 处理 el-upload exceed 事件，超出限制时弹出提示。
 */
function handleExceed(files: File[]): void {
  ElMessage.warning(
    `本次选择了 ${files.length} 个文件，当前已达上限（${props.limit} 个），请先删除部分附件再上传。`
  )
}

/**
 * 过滤掉已上传的 UploadFile（el-upload 内部状态），
 * 避免 el-upload 的文件列表与 innerFiles 重复展示。
 * 由于我们自行管理列表 UI，始终返回空数组。
 */
function filterUploadList(_file: UploadFile, _fileList: UploadFile[]): boolean {
  return false
}
</script>

<template>
  <!-- 工单附件上传区域 -->
  <div class="file-upload" :class="{ 'file-upload--disabled': disabled }">

    <!-- 上传触发区 -->
    <ElUpload
      v-if="!disabled"
      class="file-upload__trigger"
      drag
      multiple
      :action="action"
      :accept="accept"
      :limit="limit"
      :show-file-list="false"
      :before-upload="handleBeforeUpload"
      :http-request="handleHttpRequest"
      :on-exceed="handleExceed"
      :file-list="[]"
      :on-change="filterUploadList"
      :disabled="isLimitReached"
      data-testid="file-upload-dragger"
    >
      <div class="file-upload__drop-area" :class="{ 'is-limit-reached': isLimitReached }">
        <ElIcon class="file-upload__icon" :size="40">
          <UploadFilled />
        </ElIcon>
        <p class="file-upload__hint-primary">
          将文件拖到此处，或
          <ElButton type="primary" link :disabled="isLimitReached">点击上传</ElButton>
        </p>
        <p class="file-upload__hint-secondary">
          支持 {{ accept || '所有格式' }} · 单文件最大 {{ maxSizeMb }} MB · 最多 {{ limit }} 个附件
        </p>
        <p v-if="isLimitReached" class="file-upload__hint-limit">
          已达上限，请先删除附件后再上传
        </p>
      </div>
    </ElUpload>

    <!-- 已上传文件列表 -->
    <ul
      v-if="innerFiles.length > 0"
      class="file-upload__list"
      data-testid="file-upload-list"
    >
      <li
        v-for="file in innerFiles"
        :key="file.uid"
        class="file-upload__item"
        :class="`file-upload__item--${file.status}`"
        :data-testid="`file-item-${file.uid}`"
      >
        <!-- 文件图标 -->
        <ElIcon class="file-upload__item-icon">
          <Loading v-if="file.status === 'uploading'" class="is-loading" />
          <Document v-else />
        </ElIcon>

        <!-- 文件信息 -->
        <div class="file-upload__item-info">
          <span
            class="file-upload__item-name"
            :title="file.name"
            :data-testid="`file-name-${file.uid}`"
          >
            {{ file.name }}
          </span>
          <span
            class="file-upload__item-size"
            :data-testid="`file-size-${file.uid}`"
          >
            {{ formatFileSize(file.size) }}
          </span>

          <!-- 上传进度条 -->
          <ElProgress
            v-if="file.status === 'uploading'"
            :percentage="file.percent"
            :stroke-width="3"
            :show-text="false"
            class="file-upload__item-progress"
          />

          <!-- 错误信息 -->
          <span
            v-if="file.status === 'error'"
            class="file-upload__item-error"
            :data-testid="`file-error-${file.uid}`"
          >
            {{ file.errorMessage ?? '上传失败' }}
          </span>
        </div>

        <!-- 删除按钮 -->
        <ElButton
          v-if="!disabled"
          type="danger"
          link
          class="file-upload__item-remove"
          :disabled="file.status === 'uploading'"
          :aria-label="`删除附件 ${file.name}`"
          :data-testid="`file-remove-${file.uid}`"
          @click="removeFile(file.uid)"
        >
          <ElIcon><Delete /></ElIcon>
        </ElButton>
      </li>
    </ul>

    <!-- 空状态：disabled 模式下且没有附件 -->
    <p
      v-if="disabled && innerFiles.length === 0"
      class="file-upload__empty-disabled"
      data-testid="file-upload-empty"
    >
      暂无附件
    </p>
  </div>
</template>

<style lang="scss" scoped>
.file-upload {
  width: 100%;

  /* ── 上传触发区 ── */
  &__trigger {
    width: 100%;

    :deep(.el-upload) {
      width: 100%;
    }

    :deep(.el-upload-dragger) {
      width: 100%;
      height: auto;
      padding: 24px 16px;
      border-radius: 8px;
      transition: border-color 0.2s ease;
    }
  }

  &__drop-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    pointer-events: none; // 由 el-upload 自身处理点击

    &.is-limit-reached {
      opacity: 0.5;
    }
  }

  &__icon {
    color: var(--el-color-primary);
  }

  &__hint-primary {
    font-size: 14px;
    color: var(--el-text-color-regular);
    pointer-events: auto; // 允许内部 ElButton link 响应点击

    .el-button {
      font-size: 14px;
      padding: 0;
    }
  }

  &__hint-secondary {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    margin: 0;
  }

  &__hint-limit {
    font-size: 12px;
    color: var(--el-color-warning);
    margin: 0;
  }

  /* ── 文件列表 ── */
  &__list {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    background: var(--el-fill-color-blank);
    transition: border-color 0.2s ease;

    &:hover {
      border-color: var(--el-color-primary-light-5);
    }

    &--success {
      border-color: var(--el-color-success-light-5);
    }

    &--error {
      border-color: var(--el-color-danger-light-5);
      background: var(--el-color-danger-light-9);
    }

    &--uploading {
      border-color: var(--el-color-primary-light-5);
    }
  }

  &__item-icon {
    flex-shrink: 0;
    font-size: 20px;
    color: var(--el-text-color-secondary);

    .is-loading {
      animation: spin 1s linear infinite;
    }
  }

  &__item-info {
    flex: 1;
    min-width: 0; // 允许文本截断
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
  }

  &__item-name {
    font-size: 13px;
    color: var(--el-text-color-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
    flex-shrink: 1;
  }

  &__item-size {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__item-progress {
    width: 100%;
    flex-basis: 100%;
  }

  &__item-error {
    font-size: 12px;
    color: var(--el-color-danger);
    flex-basis: 100%;
  }

  &__item-remove {
    flex-shrink: 0;
    padding: 4px;
    color: var(--el-text-color-placeholder);
    transition: color 0.2s;

    &:hover:not(:disabled) {
      color: var(--el-color-danger);
    }
  }

  /* ── disabled 模式 ── */
  &--disabled {
    .file-upload__item {
      cursor: default;

      &:hover {
        border-color: var(--el-border-color-light);
      }
    }
  }

  &__empty-disabled {
    font-size: 13px;
    color: var(--el-text-color-placeholder);
    text-align: center;
    padding: 16px 0;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>