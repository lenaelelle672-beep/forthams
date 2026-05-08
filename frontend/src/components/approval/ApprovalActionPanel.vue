<template>
  <el-form ref="formRef" :model="formData" :rules="formRules">
    <el-form-item prop="comment">
      <el-input
        v-model="formData.comment"
        type="textarea"
        :rows="3"
        placeholder="请输入审批意见"
      />
    </el-form-item>
    <div class="action-buttons">
      <el-button
        type="success"
        :disabled="disabled"
        :loading="loading"
        @click="handleSubmit('approve')"
      >
        通过
      </el-button>
      <el-button
        type="danger"
        :disabled="disabled"
        :loading="loading"
        @click="handleSubmit('reject')"
      >
        驳回
      </el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'

interface Props {
  id: string | number
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  loading: false
})

const emit = defineEmits<{
  approve: [payload: { id: string | number; comment: string }]
  reject: [payload: { id: string | number; comment: string }]
}>()

const formRef = ref<FormInstance>()
const formData = ref({ comment: '' })

const formRules: FormRules = {
  comment: [{ required: true, message: '请输入审批意见', trigger: 'blur' }]
}

const handleSubmit = async (action: 'approve' | 'reject') => {
  await formRef.value?.validate()
  emit(action, { id: props.id, comment: formData.value.comment })
}
</script>

<style scoped>
.action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>