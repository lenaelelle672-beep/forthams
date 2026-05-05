<template>
  <div class="asset-retirement-form">
    <el-card class="form-card">
      <template #header>
        <div class="card-header">
          <span class="title">资产退役申请</span>
          <el-button text @click="handleBack">
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="140px"
        class="retirement-form"
      >
        <!-- 设备信息确认区域 -->
        <div class="section-title">设备信息确认</div>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="资产名称">
              <el-input
                v-model="assetInfo.name"
                disabled
                placeholder="请从资产详情页选择设备"
              >
                <template #prefix>
                  <el-icon><Monitor /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="资产编号">
              <el-input
                v-model="assetInfo.code"
                disabled
              >
                <template #prefix>
                  <el-icon><Collection /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="规格型号">
              <el-input
                v-model="assetInfo.specification"
                disabled
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="购置日期">
              <el-date-picker
                v-model="assetInfo.purchaseDate"
                type="date"
                disabled
                placeholder="选择日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="购置金额">
              <el-input
                v-model="assetInfo.purchaseAmount"
                disabled
              >
                <template #append>元</template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="使用部门">
              <el-input
                v-model="assetInfo.department"
                disabled
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider />

        <!-- 退役原因选择 -->
        <div class="section-title">退役原因</div>
        <el-form-item
          label="退役原因"
          prop="reason"
        >
          <el-select
            v-model="formData.reason"
            placeholder="请选择退役原因"
            style="width: 100%"
            size="large"
          >
            <el-option
              v-for="item in retirementReasons"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item
          label="详细说明"
          prop="description"
        >
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="4"
            :maxlength="500"
            show-word-limit
            placeholder="请详细描述设备退役原因，如：设备故障具体情况、损坏程度等"
          />
        </el-form-item>

        <el-divider />

        <!-- 附件上传区域 -->
        <div class="section-title">附件上传</div>
        <el-form-item label="相关附件">
          <div class="upload-tips">
            <el-icon><InfoFilled /></el-icon>
            <span>支持 pdf, jpg, png, doc, docx 格式，单文件最大 10MB，最多上传 5 个附件</span>
          </div>
          <el-upload
            ref="uploadRef"
            v-model:file-list="fileList"
            action="#"
            :auto-upload="false"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :on-exceed="handleExceed"
            :before-upload="beforeUpload"
            :limit="5"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            class="attachment-uploader"
          >
            <el-button type="primary" plain>
              <el-icon><Upload /></el-icon>
              选择文件
            </el-button>
            <template #tip>
              <div class="el-upload__tip">
                已上传 {{ fileList.length }}/5 个文件
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <el-divider />

        <!-- 提交按钮区域 -->
        <el-form-item class="form-actions">
          <el-button
            size="large"
            @click="handleBack"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            size="large"
            :loading="submitting"
            :disabled="!canSubmit"
            @click="handleSubmit"
          >
            提交申请
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 确认对话框 -->
    <el-dialog
      v-model="confirmDialogVisible"
      title="确认提交"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="confirm-content">
        <el-alert
          type="warning"
          :closable="false"
          show-icon
        >
          <template #title>
            提交后将无法撤回，请确认信息无误
          </template>
        </el-alert>
        <el-descriptions
          :column="1"
          border
          class="confirm-descriptions"
        >
          <el-descriptions-item label="资产编号">
            {{ assetInfo.code || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="资产名称">
            {{ assetInfo.name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="退役原因">
            {{ selectedReasonLabel }}
          </el-descriptions-item>
          <el-descriptions-item label="附件数量">
            {{ fileList.length }} 个
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="confirmDialogVisible = false">
          返回修改
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="confirmSubmit"
        >
          确认提交
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules, type UploadInstance, type UploadFile, type UploadRawFile } from 'element-plus';
import {
  ArrowLeft,
  Monitor,
  Collection,
  Upload,
  InfoFilled
} from '@element-plus/icons-vue';
import { retirementService } from '@/services/retirementService';
import type { RetirementApplication, AssetInfo } from '@/types/retirement.types';

// Props & Emits
interface Props {
  assetInfo?: AssetInfo;
}

const props = withDefaults(defineProps<Props>(), {
  assetInfo: () => ({
    id: '',
    code: '',
    name: '',
    specification: '',
    purchaseDate: '',
    purchaseAmount: 0,
    department: ''
  })
});

const emit = defineEmits<{
  (e: 'submit-success', data: RetirementApplication): void;
  (e: 'cancel'): void;
}>();

// Router & Route
const router = useRouter();
const route = useRoute();

// Refs
const formRef = ref<FormInstance>();
const uploadRef = ref<UploadInstance>();

// State
const submitting = ref(false);
const confirmDialogVisible = ref(false);
const fileList = ref<UploadFile[]>([]);

const formData = ref<{
  reason: string;
  description: string;
  assetId: string;
}>({
  reason: '',
  description: '',
  assetId: ''
});

// 退役原因枚举
const retirementReasons = [
  { value: 'EQUIPMENT_FAILURE', label: '设备故障无法修复' },
  { value: 'UPGRADE_REPLACEMENT', label: '升级换代淘汰' },
  { value: 'EXPIRED_LIFECYCLE', label: '超过使用年限' },
  { value: 'DAMAGE_LOSS', label: '损坏或丢失' },
  { value: 'OTHER', label: '其他原因' }
];

// Computed
const canSubmit = computed(() => {
  return formData.value.reason && props.assetInfo.id;
});

const selectedReasonLabel = computed(() => {
  const reason = retirementReasons.find(r => r.value === formData.value.reason);
  return reason?.label || '-';
});

// Form validation rules
const formRules: FormRules = {
  reason: [
    { required: true, message: '请选择退役原因', trigger: 'change' }
  ],
  description: [
    { required: true, message: '请填写详细说明', trigger: 'blur' },
    { min: 10, message: '详细说明至少需要10个字符', trigger: 'blur' }
  ]
};

// Allowed file types
const allowedFileTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
const maxFileSize = 10 * 1024 * 1024; // 10MB

// Methods

/ validate file type
const isValidFileType = (file: File): boolean => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  return allowedExtensions.includes(extension);
};

// Before upload hook
const beforeUpload = (file: File): boolean | void => {
  // Check file size
  if (file.size > maxFileSize) {
    ElMessage.error(`文件 ${file.name} 大小超过 10MB 限制`);
    return false;
  }

  // Check file type
  if (!isValidFileType(file)) {
    ElMessage.error(`文件 ${file.name} 格式不支持，支持格式：${allowedExtensions.join(', ')}`);
    return false;
  }

  return true;
};

// Handle file change
const handleFileChange = (uploadFile: UploadFile, uploadFiles: UploadFile[]): void => {
  fileList.value = uploadFiles;
};

// Handle file remove
const handleFileRemove = (file: UploadFile, uploadFiles: UploadFile[]): void => {
  fileList.value = uploadFiles;
};

// Handle exceed limit
const handleExceed = (): void => {
  ElMessage.warning('最多只能上传 5 个附件');
};

// Reset form
const resetForm = (): void => {
  formData.value = {
    reason: '',
    description: '',
    assetId: ''
  };
  fileList.value = [];
  formRef.value?.resetFields();
};

// Handle back
const handleBack = (): void => {
  if (submitting.value) return;
  emit('cancel');
  router.back();
};

// Validate form before submit
const validateForm = async (): Promise<boolean> => {
  if (!formRef.value) return false;
  
  try {
    await formRef.value.validate();
    return true;
  } catch {
    return false;
  }
};

// Handle submit
const handleSubmit = async (): Promise<void> => {
  // Validate form
  const isValid = await validateForm();
  if (!isValid) {
    ElMessage.error('请完整填写退役申请信息');
    return;
  }

  // Check asset info
  if (!props.assetInfo.id) {
    ElMessage.error('请从资产详情页选择设备');
    return;
  }

  // Show confirm dialog
  confirmDialogVisible.value = true;
};

// Confirm submit
const confirmSubmit = async (): Promise<void> => {
  submitting.value = true;
  confirmDialogVisible.value = false;

  try {
    // Prepare attachments
    const attachments = fileList.value.map((file, index) => ({
      name: file.name,
      uid: file.uid?.toString() || `file_${index}`,
      size: file.size || 0,
      type: file.raw?.type || 'application/octet-stream'
    }));

    // Prepare request data
    const requestData = {
      assetId: props.assetInfo.id,
      reason: formData.value.reason,
      description: formData.value.description,
      attachments
    };

    // Submit retirement application
    const result = await retirementService.submitRetirement(requestData);

    ElMessage.success('退役申请提交成功');
    emit('submit-success', result);

    // Navigate to application list or detail page
    router.push({
      name: 'retirement-list'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '提交失败，请重试';
    ElMessage.error(errorMessage);
  } finally {
    submitting.value = false;
  }
};

// Watch for asset info changes from parent
watch(() => props.assetInfo, (newInfo) => {
  if (newInfo?.id) {
    formData.value.assetId = newInfo.id;
  }
}, { immediate: true });

// Expose methods for parent component
defineExpose({
  resetForm,
  validateForm
});
</script>

<style scoped lang="scss">
.asset-retirement-form {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.form-card {
  max-width: 900px;
  margin: 0 auto;
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .title {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }
}

.retirement-form {
  padding: 8px 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
  margin: 16px 0;
  padding-left: 12px;
  border-left: 3px solid #409eff;

  &::before {
    content: '';
    display: inline-block;
  }
}

.upload-tips {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: #f4f4f5;
  border-radius: 4px;
  color: #909399;
  font-size: 13px;
  margin-bottom: 12px;

  .el-icon {
    color: #409eff;
  }
}

.attachment-uploader {
  :deep(.el-upload) {
    width: 100%;
  }
}

.form-actions {
  margin-top: 32px;
  text-align: center;

  .el-button {
    min-width: 120px;
  }
}

.confirm-content {
  .confirm-descriptions {
    margin-top: 20px;
  }
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: #f5f7fa;
  cursor: not-allowed;
}

:deep(.el-input.is-disabled .el-input__inner) {
  color: #606266;
}
</style>