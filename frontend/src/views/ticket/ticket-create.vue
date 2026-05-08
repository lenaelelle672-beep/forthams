<template>
  <div data-testid="ticket-page-container" class="ticket-create-page">
    <h2>创建工单</h2>
    <Form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      layout="vertical"
      data-testid="ticket-form"
      @finish="handleSubmit"
    >
      <FormItem label="标题" name="title">
        <Input v-model:value="formData.title" placeholder="请输入工单标题" />
      </FormItem>

      <FormItem label="类型" name="type">
        <Select v-model:value="formData.type" placeholder="请选择工单类型">
          <Option value="bug">Bug 报告</Option>
          <Option value="feature">功能请求</Option>
          <Option value="task">任务分配</Option>
          <Option value="support">技术支持</Option>
        </Select>
      </FormItem>

      <FormItem label="优先级" name="priority">
        <Select v-model:value="formData.priority" placeholder="请选择优先级">
          <Option value="low">低</Option>
          <Option value="medium">中</Option>
          <Option value="high">高</Option>
          <Option value="critical">紧急</Option>
        </Select>
      </FormItem>

      <FormItem label="描述" name="description">
        <TextArea v-model:value="formData.description" :rows="4" placeholder="请详细描述工单内容" />
      </FormItem>

      <div style="margin-top: 16px; text-align: right;">
        <Button @click="goBack">取消</Button>
        <Button type="primary" html-type="submit" :loading="submitting">创建工单</Button>
      </div>
    </Form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { Form, Input, Select, Button, message } from 'ant-design-vue';
const { Item: FormItem } = Form;
const { Option } = Select;
const { TextArea } = Input;

const router = useRouter();
const formRef = ref();
const submitting = ref(false);

const formData = reactive({
  title: '',
  type: undefined as string | undefined,
  priority: 'medium',
  description: ''
});

const formRules = {
  title: [{ required: true, message: '请输入工单标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择工单类型', trigger: 'change' }]
};

const handleSubmit = async () => {
  try {
    submitting.value = true;
    // TODO: Implement API call for creating ticket
    console.log('Creating ticket:', formData);
    message.success('工单创建成功');
    router.push('/ticket/list');
  } catch (error) {
    message.error('创建失败，请重试');
  } finally {
    submitting.value = false;
  }
};

const goBack = () => {
  router.back();
};
</script>

<style scoped>
.ticket-create-page {
  padding: 24px;
}
</style>