<template>
  <div data-testid="base-search-bar" class="search-bar-container">
    <div class="search-input-wrapper">
      <input
        v-model="localKeyword"
        :placeholder="placeholder || '搜索...'"
        @keyup.enter="handleSearch"
        data-testid="search-input"
      />
      <button
        @click="handleSearch"
        data-testid="btn-search"
      >
        搜索
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  placeholder?: string
  initialKeyword?: string
}>()

const emit = defineEmits<{
  (e: 'search', keyword: string): void
}>()

const localKeyword = ref(props.initialKeyword || '')

watch(() => props.initialKeyword, (val) => {
  if (val !== undefined) localKeyword.value = val
})

const handleSearch = () => {
  emit('search', localKeyword.value)
}
</script>

<style scoped>
.search-bar-container {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-input-wrapper {
  display: flex;
  gap: 8px;
}

.search-input-wrapper input {
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  min-width: 200px;
}

.search-input-wrapper input:focus {
  outline: none;
  border-color: #1890ff;
}

.search-input-wrapper button {
  padding: 6px 16px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.search-input-wrapper button:hover {
  background-color: #40a9ff;
}
</style>