<template>
  <div data-testid="base-pagination" class="pagination-container">
    <button
      :disabled="currentPage === 1"
      @click="changePage(currentPage - 1)"
      data-testid="btn-prev-page"
    >
      &lt;
    </button>

    <span class="page-info">
      第 {{ currentPage }} / {{ totalPages }} 页 (共 {{ totalItems }} 条)
    </span>

    <button
      :disabled="currentPage === totalPages || totalPages === 0"
      @click="changePage(currentPage + 1)"
      data-testid="btn-next-page"
    >
      &gt;
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentPage: number
  pageSize: number
  totalItems: number
}>()

const emit = defineEmits<{
  (e: 'page-change', page: number): void
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.pageSize)))

const changePage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    emit('page-change', page)
  }
}
</script>

<style scoped>
.pagination-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 0;
}

button {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;
  background-color: white;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
}

button:hover:not(:disabled) {
  border-color: #1890ff;
  color: #1890ff;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.page-info {
  font-size: 14px;
  color: #666;
}
</style>