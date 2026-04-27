<script setup lang="ts">
/**
 * ApprovalComment.vue
 * 工单审批意见组件
 * 
 * 功能说明：
 * - 支持审批人输入审批意见（通过/拒绝/驳回）
 * - 提供三种审批操作：通过(APPROVED)、拒绝(REJECTED)、驳回要求修改(REVISION_REQUIRED)
 * - 触发审批事件并通知后端状态机流转
 * 
 * @version Iteration 1 / Phase 1
 * @owner 规格执行工程师
 */
import { ref, computed, defineProps, defineEmits } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { workOrderApi } from '../api/workOrderApi'

// Props: 工单ID和当前用户权限
const props = defineProps<{
  workOrderId: string
  canApprove: boolean
  canReject: boolean
  canRevise: boolean
  approverName?: string
}>()

const emit = defineEmits<{
  (e: 'approval-complete', action: string): void
  (e: 'approval-error', error: Error): void
}>()

// 表单引用
const formRef = ref<FormInstance>()

// 审批意见表单数据
const formData = ref({
  comment: '',
  action: '' as 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED' | ''
})

// 提交状态
const submitting = ref(false)

// 审批操作选项
const approvalActions = computed(() => [
  { value: 'APPROVED', label: '通过', type: 'success', disabled: !props.canApprove },
  { value: 'REJECTED', label: '拒绝', type: 'danger', disabled: !props.canReject },
  { value: 'REVISION_REQUIRED', label: '驳回修改', type: 'warning', disabled: !props.canRevise }
])

// 确认操作文本映射
const actionConfirmText: Record<string, string> = {
  'APPROVED': '确认通过此工单？',
  'REJECTED': '确认拒绝此工单？',
  'REVISION_REQUIRED': '确认驳回此工单，要求修改？'
}

// 选择审批操作
function selectAction(action: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED') {
  formData.value.action = action
}

// 提交审批
async function submitApproval() {
  if (!formData.value.action) {
    ElMessage.warning('请选择审批操作')
    return
  }

  if (!formData.value.comment.trim() && formData.value.action !== 'APPROVED') {
    ElMessage.warning('请输入审批意见')
    return
  }

  try {
    await ElMessageBox.confirm(
      actionConfirmText[formData.value.action],
      '确认审批',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    ElMessage.info('已取消操作')
    return
  }

  submitting.value = true

  try {
    const result = await workOrderApi.approveWorkOrder(props.workOrderId, {
      action: formData.value.action,
      comment: formData.value.comment
    })

    if (result.success) {
      ElMessage.success('审批操作成功')
      emit('approval-complete', formData.value.action)
      
      // 重置表单
      resetForm()
    } else {
      throw new Error(result.message || '审批失败')
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('审批失败')
    ElMessage.error(err.message)
    emit('approval-error', err)
  } finally {
    submitting.value = false
  }
}

// 重置表单
function resetForm() {
  formData.value.action = ''
  formData.value.comment = ''
  formRef.value?.clearValidate()
}

// 取消操作
function cancelApproval() {
  resetForm()
}
</script>

<template>
  <div class="approval-comment">
    <el-card class="approval-card">
      <template #header>
        <div class="approval-header">
          <span class="title">审批操作</span>
          <span v-if="approverName" class="approver-name">{{ approverName }}</span>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        label-position="top"
        class="approval-form"
      >
        <!-- 审批操作按钮组 -->
        <el-form-item label="审批操作" required>
          <div class="action-buttons">
            <el-button
              v-for="action in approvalActions"
              :key="action.value"
              :type="action.type"
              :disabled="action.disabled || submitting"
              :class="{ 'active-action': formData.action === action.value }"
              @click="selectAction(action.value as 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED')"
            >
              {{ action.label }}
            </el-button>
          </div>
        </el-form-item>

        <!-- 审批意见输入 -->
        <el-form-item 
          label="审批意见" 
          :required="formData.action === 'REJECTED' || formData.action === 'REVISION_REQUIRED'"
        >
          <el-input
            v-model="formData.comment"
            type="textarea"
            :rows="4"
            :placeholder="formData.action === 'APPROVED' ? '可选：输入审批备注' : '请输入审批意见'"
            :maxlength="500"
            show-word-limit
            :disabled="submitting"
          />
        </el-form-item>

        <!-- 操作按钮 -->
        <el-form-item class="form-actions">
          <el-button 
            type="primary" 
            :loading="submitting"
            :disabled="!formData.action"
            @click="submitApproval"
          >
            提交审批
          </el-button>
          <el-button 
            @click="cancelApproval"
            :disabled="submitting"
          >
            取消
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.approval-comment {
  .approval-card {
    margin-bottom: 16px;
  }

  .approval-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title {
      font-weight: 600;
      font-size: 16px;
    }

    .approver-name {
      font-size: 12px;
      color: #909399;
    }
  }

  .approval-form {
    .action-buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;

      .el-button {
        min-width: 100px;

        &.active-action {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
      }
    }

    .form-actions {
      margin-top: 24px;
      text-align: right;

      .el-button {
        min-width: 100px;
      }
    }
  }
}
</style>