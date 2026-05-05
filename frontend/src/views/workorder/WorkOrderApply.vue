<template>
  <div class="workorder-apply-container" data-testid="workorder-apply-page">
    <el-card class="apply-card">
      <template #header>
        <div class="card-header">
          <span class="title">工单审批申请</span>
          <el-button text @click="handleBack">
            <el-icon><ArrowLeft /></el-icon>
            返回列表
          </el-button>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
        class="workorder-form"
        :disabled="isSubmitting"
      >
        <el-form-item label="工单标题" prop="title" data-testid="apply-title">
          <el-input
            v-model="formData.title"
            placeholder="请输入工单标题（不超过100字符）"
            maxlength="100"
            show-word-limit
            clearable
          />
        </el-form-item>

        <el-form-item label="工单类别" prop="category">
          <el-select
            v-model="formData.category"
            placeholder="请选择工单类别"
            class="full-width"
          >
            <el-option label="资产报废申请" value="ASSET_SCRAP" />
            <el-option label="资产维保申请" value="ASSET_MAINTENANCE" />
            <el-option label="资产转让申请" value="ASSET_TRANSFER" />
            <el-option label="其他申请" value="OTHER" />
          </el-select>
        </el-form-item>

        <el-form-item label="紧急程度" prop="priority">
          <el-radio-group v-model="formData.priority">
            <el-radio value="LOW">低</el-radio>
            <el-radio value="MEDIUM">中</el-radio>
            <el-radio value="HIGH">高</el-radio>
            <el-radio value="URGENT">紧急</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="工单描述" prop="description" data-testid="apply-description">
          <el-input
            v-model="formData.description"
            type="textarea"
            placeholder="请详细描述工单内容（至少10个字符）"
            :rows="6"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="关联资产" prop="assetIds">
          <el-select
            v-model="formData.assetIds"
            multiple
            placeholder="请选择关联资产（可选）"
            class="full-width"
            filterable
            remote
            :remote-method="searchAssets"
            :loading="isSearchingAssets"
            collapse-tags
            collapse-tags-tooltip
          >
            <el-option
              v-for="asset in searchedAssets"
              :key="asset.id"
              :label="asset.name"
              :value="asset.id"
            >
              <span>{{ asset.name }}</span>
              <span class="asset-code">{{ asset.code }}</span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="附件上传">
          <el-upload
            ref="uploadRef"
            v-model:file-list="fileList"
            action="#"
            :auto-upload="false"
            :limit="5"
            :on-exceed="handleExceed"
            :on-remove="handleFileRemove"
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
            list-type="text"
            data-testid="apply-upload"
          >
            <el-button type="primary" plain>
              <el-icon><Upload /></el-icon>
              选择文件
            </el-button>
            <template #tip>
              <div class="upload-tip">
                支持 JPG、PNG、PDF、DOC、XLS 格式，最多上传5个文件，单个文件不超过10MB
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <el-form-item label="期望完成日期" prop="expectedDate">
          <el-date-picker
            v-model="formData.expectedDate"
            type="date"
            placeholder="选择期望完成日期"
            class="full-width"
            :disabled-date="disabledDate"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>

        <el-form-item label="审批人" prop="approverId">
          <el-select
            v-model="formData.approverId"
            placeholder="请选择审批人"
            class="full-width"
            filterable
          >
            <el-option
              v-for="approver in approverList"
              :key="approver.id"
              :label="approver.name"
              :value="approver.id"
            >
              <span>{{ approver.name }}</span>
              <span class="approver-dept">{{ approver.department }}</span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item>
          <div class="form-actions">
            <el-button @click="handleReset">重置</el-button>
            <el-button
              type="primary"
              :loading="isSubmitting"
              data-testid="apply-submit"
              @click="handleSubmit"
            >
              {{ isSubmitting ? '提交中...' : '提交申请' }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 提交成功对话框 -->
    <el-dialog
      v-model="showSuccessDialog"
      title="提交成功"
      width="400px"
      :close-on-click-modal="false"
      data-testid="apply-success-dialog"
    >
      <div class="success-content">
        <el-icon class="success-icon" color="#67c23a" size="48">
          <CircleCheck />
        </el-icon>
        <p class="success-message">您的工单已成功提交！</p>
        <p class="workorder-id">工单编号：{{ submittedWorkOrderId }}</p>
      </div>
      <template #footer>
        <el-button @click="handleViewList">查看工单列表</el-button>
        <el-button type="primary" @click="handleContinue">继续添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * WorkOrderApply.vue - 工单审批申请页面
 * 
 * 功能说明：
 * - 提供工单审批申请的表单填写界面
 * - 支持标题、类别、描述、附件等信息的录入
 * - 提交后显示成功提示并可跳转到列表页
 * 
 * 使用技术：
 * - Vue 3 Composition API
 * - Element Plus UI 组件库
 * - TypeScript 类型定义
 * 
 * @version 1.0.0
 * @date 2024-XX-XX
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules, type UploadInstance, type UploadProps, type UploadUserFile } from 'element-plus';
import { ArrowLeft, Upload, CircleCheck } from '@element-plus/icons-vue';
import { submitWorkOrder, searchApproverList, type WorkOrderSubmitPayload, type WorkOrderResponse } from '@/api/workorder';
import type { Asset, Approver } from '@/types/workorder.types';

// ============================================================================
// 路由与状态
// ============================================================================
const router = useRouter();

// ============================================================================
// 表单引用与数据
// ============================================================================
const formRef = ref<FormInstance>();
const uploadRef = ref<UploadInstance>();

/** 表单初始数据 */
const initialFormData: WorkOrderSubmitPayload = {
  title: '',
  category: '',
  priority: 'MEDIUM',
  description: '',
  assetIds: [],
  expectedDate: '',
  approverId: '',
  attachments: []
};

/** 表单数据 */
const formData = reactive<WorkOrderSubmitPayload>({ ...initialFormData });

/** 文件列表 */
const fileList = ref<UploadUserFile[]>([]);

/** 提交状态 */
const isSubmitting = ref(false);

/** 搜索资产状态 */
const isSearchingAssets = ref(false);

/** 搜索到的资产列表 */
const searchedAssets = ref<Asset[]>([]);

/** 审批人列表 */
const approverList = ref<Approver[]>([]);

/** 提交成功对话框显示状态 */
const showSuccessDialog = ref(false);

/** 已提交的工单ID */
const submittedWorkOrderId = ref('');

// ============================================================================
// 表单校验规则
// ============================================================================
const formRules: FormRules<WorkOrderSubmitPayload> = {
  title: [
    { required: true, message: '请输入工单标题', trigger: 'blur' },
    { max: 100, message: '标题不能超过100字符', trigger: 'blur' }
  ],
  category: [
    { required: true, message: '请选择工单类别', trigger: 'change' }
  ],
  description: [
    { required: true, message: '请输入工单描述', trigger: 'blur' },
    { min: 10, message: '描述至少10个字符', trigger: 'blur' }
  ],
  approverId: [
    { required: true, message: '请选择审批人', trigger: 'change' }
  ]
};

// ============================================================================
// 计算属性
// ============================================================================
/** 是否可以提交 */
const canSubmit = computed(() => {
  return formData.title.trim() !== '' &&
         formData.category !== '' &&
         formData.description.trim().length >= 10 &&
         formData.approverId !== '';
});

// ============================================================================
// 方法
// ============================================================================

/**
 * 禁用过去的日期
 * @param date - 待判断的日期
 */
const disabledDate: 'disabledDate' = (date: Date) => {
  return date.getTime() < Date.now() - 8.64e7;
};

/**
 * 搜索资产
 * @param query - 搜索关键词
 */
const searchAssets = async (query: string) => {
  if (!query || query.length < 2) {
    searchedAssets.value = [];
    return;
  }

  isSearchingAssets.value = true;
  try {
    // 实际项目中调用资产搜索 API
    // const result = await searchAssetList(query);
    // searchedAssets.value = result;
    
    // Mock 数据
    searchedAssets.value = [
      { id: '1', name: '笔记本电脑 Dell XPS 15', code: 'AST-2024-001' },
      { id: '2', name: '显示器 LG 27寸', code: 'AST-2024-002' }
    ].filter(asset => 
      asset.name.includes(query) || asset.code.includes(query)
    );
  } catch (error) {
    ElMessage.error('搜索资产失败');
    searchedAssets.value = [];
  } finally {
    isSearchingAssets.value = false;
  }
};

/**
 * 文件数量超限处理
 * @param files - 当前选择的文件列表
 * @param uploadFiles - 已上传的文件列表
 */
const handleExceed: 'onExceed' = (files: File[], uploadFiles: UploadUserFile[]) => {
  ElMessage.warning(`最多只能上传5个文件，已选择 ${files.length} 个文件`);
};

/**
 * 移除文件处理
 * @param file - 被移除的文件
 */
const handleFileRemove: 'onRemove' = (file: UploadUserFile) => {
  const index = fileList.value.findIndex(f => f.uid === file.uid);
  if (index > -1) {
    fileList.value.splice(index, 1);
  }
};

/**
 * 处理附件数据，用于提交
 */
const processAttachments = (): string[] => {
  return fileList.value.map(file => file.name);
};

/**
 * 提交表单
 */
const handleSubmit = async () => {
  if (!formRef.value) return;

  try {
    // 表单验证
    await formRef.value.validate();
  } catch (error) {
    ElMessage.error('请完善表单信息');
    return;
  }

  isSubmitting.value = true;

  try {
    // 处理附件
    formData.attachments = processAttachments();

    // 调用提交 API
    const result = await submitWorkOrder(formData);

    if (result && result.id) {
      submittedWorkOrderId.value = result.id;
      showSuccessDialog.value = true;
      ElMessage.success('工单提交成功');
    } else {
      throw new Error('提交响应异常');
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '提交失败，请稍后重试';
    ElMessage.error(errorMessage);
    // 表单数据保留，不跳转
  } finally {
    isSubmitting.value = false;
  }
};

/**
 * 重置表单
 */
const handleReset = () => {
  if (!formRef.value) return;
  formRef.value.resetFields();
  fileList.value = [];
  Object.assign(formData, initialFormData);
};

/**
 * 返回列表
 */
const handleBack = () => {
  router.push('/workorder/list');
};

/**
 * 查看工单列表
 */
const handleViewList = () => {
  showSuccessDialog.value = false;
  router.push('/workorder/list');
};

/**
 * 继续添加
 */
const handleContinue = () => {
  showSuccessDialog.value = false;
  handleReset();
};

/**
 * 加载审批人列表
 */
const loadApproverList = async () => {
  try {
    const result = await searchApproverList();
    approverList.value = result;
  } catch (error) {
    ElMessage.error('加载审批人列表失败');
    // 使用默认空列表
    approverList.value = [];
  }
};

// ============================================================================
// 生命周期钩子
// ============================================================================
onMounted(() => {
  loadApproverList();
});
</script>

<style scoped lang="scss">
.workorder-apply-container {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.apply-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title {
      font-size: 18px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
}

.workorder-form {
  padding: 16px 0;

  .full-width {
    width: 100%;
  }

  .upload-tip {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  :deep(.el-select .el-select__tags) {
    max-height: 80px;
    overflow-y: auto;
  }

  :deep(.el-select-dropdown__item) {
    height: auto;
    padding: 8px;
    line-height: 1.4;
  }

  .asset-code,
  .approver-dept {
    display: block;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  width: 100%;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.success-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;

  .success-icon {
    margin-bottom: 16px;
  }

  .success-message {
    font-size: 16px;
    color: var(--el-text-color-primary);
    margin-bottom: 8px;
  }

  .workorder-id {
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }
}
</style>