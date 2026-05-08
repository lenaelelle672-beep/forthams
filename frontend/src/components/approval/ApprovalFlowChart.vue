<template>
  <div class="approval-flow-chart">
    <div class="flow-nodes-container">
      <template v-for="(item, index) in approvalHistory" :key="index">
        <el-tooltip v-if="item.status === 'REJECTED' && item.reason" placement="top" :content="item.reason">
          <div class="approval-flow-node" :class="{ 'is-current': item.isCurrent }" :data-status="item.status">
            <div class="node-content">
              <el-icon :size="20" data-testid="icon-clock" v-if="item.status === 'PENDING'"><Clock /></el-icon>
              <el-icon :size="20" data-testid="icon-check" v-else-if="item.status === 'APPROVED'"><CircleCheck /></el-icon>
              <el-icon :size="20" data-testid="icon-reject" v-else-if="item.status === 'REJECTED'"><CircleClose /></el-icon>
            </div>
          </div>
        </el-tooltip>
        <div v-else class="approval-flow-node" :class="{ 'is-current': item.isCurrent }" :data-status="item.status">
          <div class="node-content">
            <el-icon :size="20" data-testid="icon-clock" v-if="item.status === 'PENDING'"><Clock /></el-icon>
            <el-icon :size="20" data-testid="icon-check" v-else-if="item.status === 'APPROVED'"><CircleCheck /></el-icon>
            <el-icon :size="20" data-testid="icon-reject" v-else-if="item.status === 'REJECTED'"><CircleClose /></el-icon>
          </div>
        </div>
        <div v-if="index < approvalHistory.length - 1" class="flow-line"></div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Clock, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import type { ApprovalHistoryItem } from '../../types/approval'

interface Props {
  approvalHistory: ApprovalHistoryItem[]
}

defineProps<Props>()
</script>

<style scoped>
.approval-flow-chart {
  display: flex;
  justify-content: center;
  padding: 24px 0;
  overflow-x: auto;
}

.flow-nodes-container {
  display: flex;
  align-items: center;
}

.approval-flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.node-content {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  border: 2px solid #d9d9d9;
  transition: all 0.3s ease;
  cursor: default;
}

.is-current .node-content {
  border-color: #1890ff;
  box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
  background-color: #e6f7ff;
}

.is-current :deep(.el-icon) {
  color: #1890ff;
}

.approval-flow-node[data-status="APPROVED"] .node-content {
  border-color: #52c41a;
  background-color: #f6ffed;
}

.approval-flow-node[data-status="APPROVED"] :deep(.el-icon) {
  color: #52c41a;
}

.approval-flow-node[data-status="REJECTED"] .node-content {
  border-color: #ff4d4f;
  background-color: #fff2f0;
}

.approval-flow-node[data-status="REJECTED"] :deep(.el-icon) {
  color: #ff4d4f;
}

.flow-line {
  width: 32px;
  height: 2px;
  background-color: #d9d9d9;
  flex-shrink: 0;
}

.approval-flow-node.is-current + .flow-line {
  background-color: #1890ff;
}

.approval-flow-node[data-status="APPROVED"] + .flow-line {
  background-color: #52c41a;
}
</style>
