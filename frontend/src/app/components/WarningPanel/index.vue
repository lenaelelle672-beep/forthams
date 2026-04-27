<template>
  <!-- 到期预警面板组件 -->
  <!-- 展示维保/报废到期预警列表，支持空态、加载骨架屏、预警等级高亮 -->
  <div class="warning-panel" :class="`warning-panel--${type}`">
    <!-- 面板头部：标题 + 数量徽章 -->
    <div class="warning-panel__header">
      <span class="warning-panel__title">{{ title }}</span>
      <el-badge
        class="badge"
        :value="list.length"
        :max="99"
        :type="badgeType"
      />
    </div>

    <!-- 加载骨架屏 -->
    <template v-if="loading">
      <el-skeleton :rows="5" animated class="warning-panel__skeleton" />
    </template>

    <!-- 空态占位 -->
    <template v-else-if="list.length === 0">
      <div class="warning-empty">
        <el-empty :image-size="64" description="">
          <template #description>
            <span class="warning-empty__text">暂无预警</span>
          </template>
        </el-empty>
      </div>
    </template>

    <!-- 预警列表 -->
    <template v-else>
      <ul class="warning-panel__list">
        <li
          v-for="item in list"
          :key="item.id"
          class="warning-item"
          :class="getWarningItemClass(item.daysLeft)"
        >
          <!-- 左侧：预警等级指示条 -->
          <span class="warning-item__indicator" :class="`warning-item__indicator--${getWarningLevel(item.daysLeft)}`" />

          <!-- 中间：资产名称 + 到期日期 -->
          <div class="warning-item__body">
            <span class="warning-item__name" :title="item.name">{{ item.name }}</span>
            <span class="warning-item__id">{{ item.id }}</span>
          </div>

          <!-- 右侧：剩余天数标签 -->
          <div class="warning-item__meta">
            <el-tag
              size="small"
              :type="getTagType(item.daysLeft)"
              class="warning-item__days-tag"
            >
              {{ item.daysLeft <= 0 ? '已到期' : `${item.daysLeft}天后` }}
            </el-tag>
            <span class="warning-item__expire-date">{{ item.expireDate }}</span>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<script lang="ts" setup>
/**
 * WarningPanel — 到期预警面板组件
 *
 * 功能：
 *  - 展示维保（maintenance）或报废（scrap）到期预警资产列表
 *  - 支持 loading 骨架屏状态
 *  - 列表为空时显示「暂无预警」空态占位图
 *  - 根据剩余天数自动判定预警等级并应用对应样式类
 *    - critical  : daysLeft ≤ 7  → 紧急（红色）
 *    - warning   : daysLeft ≤ 30 → 预警（橙色）
 *    - normal    : daysLeft > 30  → 正常（绿色）
 *
 * Props：
 *  - title   {string}        面板标题
 *  - list    {WarningItem[]} 预警数据列表
 *  - type    {string}        预警类型标识（maintenance | scrap），用于面板 class 区分
 *  - loading {boolean}       是否处于加载中状态
 */

import { computed } from 'vue'

/** 单条预警数据的类型定义 */
export interface WarningItem {
  /** 资产 ID，如 AST-001 */
  id: string
  /** 资产名称 */
  name: string
  /** 到期日期，格式 YYYY-MM-DD */
  expireDate: string
  /** 距到期剩余天数；≤0 表示已到期 */
  daysLeft: number
}

const props = withDefaults(
  defineProps<{
    /** 面板标题 */
    title: string
    /** 预警列表数据 */
    list: WarningItem[]
    /** 预警类型：maintenance（维保）| scrap（报废） */
    type?: 'maintenance' | 'scrap'
    /** 是否处于加载状态 */
    loading?: boolean
  }>(),
  {
    type: 'maintenance',
    loading: false,
  }
)

/**
 * 根据剩余天数计算预警等级
 * @param daysLeft 剩余天数
 * @returns 'critical' | 'warning' | 'normal'
 */
function getWarningLevel(daysLeft: number): 'critical' | 'warning' | 'normal' {
  if (daysLeft <= 7) return 'critical'
  if (daysLeft <= 30) return 'warning'
  return 'normal'
}

/**
 * 返回预警列表项的 CSS class（包含等级修饰符）
 * @param daysLeft 剩余天数
 */
function getWarningItemClass(daysLeft: number): string {
  const level = getWarningLevel(daysLeft)
  return `warning-item--${level}`
}

/**
 * 根据剩余天数返回 Element Plus Tag 的 type 属性
 * @param daysLeft 剩余天数
 */
function getTagType(daysLeft: number): 'danger' | 'warning' | 'success' {
  const level = getWarningLevel(daysLeft)
  const map: Record<string, 'danger' | 'warning' | 'success'> = {
    critical: 'danger',
    warning: 'warning',
    normal: 'success',
  }
  return map[level]
}

/**
 * 徽章的 Element Plus type
 * 有 critical 级别时显示红色，否则显示橙色
 */
const badgeType = computed<'danger' | 'warning'>(() => {
  const hasCritical = props.list.some((item) => item.daysLeft <= 7)
  return hasCritical ? 'danger' : 'warning'
})
</script>

<style scoped>
/* ========================
   面板容器
   ======================== */
.warning-panel {
  display: flex;
  flex-direction: column;
  height: 320px;
  background: var(--el-bg-color, #ffffff);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
}

/* ========================
   面板头部
   ======================== */
.warning-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter, #f0f0f0);
  flex-shrink: 0;
}

.warning-panel__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
}

/* ========================
   骨架屏
   ======================== */
.warning-panel__skeleton {
  padding: 16px;
}

/* ========================
   空态
   ======================== */
.warning-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.warning-empty__text {
  font-size: 13px;
  color: var(--el-text-color-secondary, #909399);
}

/* ========================
   列表
   ======================== */
.warning-panel__list {
  flex: 1;
  overflow-y: auto;
  margin: 0;
  padding: 4px 0;
  list-style: none;
}

/* 自定义滚动条 */
.warning-panel__list::-webkit-scrollbar {
  width: 4px;
}
.warning-panel__list::-webkit-scrollbar-thumb {
  background: var(--el-border-color, #dcdfe6);
  border-radius: 2px;
}
.warning-panel__list::-webkit-scrollbar-track {
  background: transparent;
}

/* ========================
   预警列表项
   ======================== */
.warning-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  transition: background-color 0.15s ease;
  cursor: default;
}

.warning-item:hover {
  background-color: var(--el-fill-color-light, #f5f7fa);
}

/* 等级修饰：紧急 */
.warning-item--critical {
  background-color: #fff5f5;
}
.warning-item--critical:hover {
  background-color: #ffe9e9;
}

/* 等级修饰：预警 */
.warning-item--warning {
  background-color: #fffbf0;
}
.warning-item--warning:hover {
  background-color: #fff3d0;
}

/* ========================
   预警等级指示条
   ======================== */
.warning-item__indicator {
  flex-shrink: 0;
  width: 3px;
  height: 32px;
  border-radius: 2px;
}

.warning-item__indicator--critical {
  background-color: var(--el-color-danger, #f56c6c);
}

.warning-item__indicator--warning {
  background-color: var(--el-color-warning, #e6a23c);
}

.warning-item__indicator--normal {
  background-color: var(--el-color-success, #67c23a);
}

/* ========================
   资产信息区
   ======================== */
.warning-item__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.warning-item__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary, #303133);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.warning-item__id {
  font-size: 11px;
  color: var(--el-text-color-placeholder, #c0c4cc);
}

/* ========================
   右侧元信息区
   ======================== */
.warning-item__meta {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

.warning-item__days-tag {
  font-size: 11px;
}

.warning-item__expire-date {
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
}
</style>