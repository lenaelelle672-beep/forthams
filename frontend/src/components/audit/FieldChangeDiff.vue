<script setup lang="ts">
/**
 * FieldChangeDiff Component
 * 
 * Displays the difference between old and new values for an auditable field change.
 * This component is used within the audit log panel to show field-level changes
 * in an intuitive diff format.
 * 
 * @component
 * @example
 * <FieldChangeDiff
 *   fieldName="assetName"
 *   oldValue="Dell Laptop XPS 15"
 *   newValue="Dell Laptop XPS 17"
 *   :showDiff="true"
 * />
 */
import { computed, ref } from 'vue';

/**
 * Props interface for FieldChangeDiff component
 */
interface Props {
  /** The name of the field that changed */
  fieldName: string;
  /** The previous value before the change */
  oldValue: string | null;
  /** The new value after the change */
  newValue: string | null;
  /** Whether to highlight the diff characters */
  showDiff?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showDiff: true,
  oldValue: null,
  newValue: null,
});

/**
 * Whether the diff is currently expanded
 */
const isExpanded = ref(false);

/**
 * Computed property to determine if there is an actual change
 * @returns {boolean} True if oldValue and newValue are different
 */
const hasChange = computed(() => {
  return props.oldValue !== props.newValue;
});

/**
 * Computed property to format the field name for display
 * @returns {string} Human-readable field name
 */
const displayFieldName = computed(() => {
  if (!props.fieldName) return 'Unknown Field';
  
  // Convert camelCase or snake_case to Title Case
  return props.fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
});

/**
 * Computed property to generate character-level diff
 * @returns {Array<{char: string, type: 'same' | 'added' | 'removed'}>} Array of diff segments
 */
const diffSegments = computed(() => {
  if (!props.showDiff || !hasChange.value) {
    return [];
  }

  const oldStr = String(props.oldValue || '');
  const newStr = String(props.newValue || '');
  const segments: Array<{char: string, type: 'same' | 'added' | 'removed'}> = [];

  // Simple character-level diff algorithm
  const maxLen = Math.max(oldStr.length, newStr.length);
  
  for (let i = 0; i < maxLen; i++) {
    const oldChar = oldStr[i];
    const newChar = newStr[i];

    if (oldChar === newChar) {
      segments.push({ char: oldChar, type: 'same' });
    } else if (newChar && !oldStr.includes(newChar)) {
      segments.push({ char: newChar, type: 'added' });
    } else if (oldChar && !newStr.includes(oldChar)) {
      segments.push({ char: oldChar, type: 'removed' });
    } else {
      if (newChar) segments.push({ char: newChar, type: 'added' });
      if (oldChar) segments.push({ char: oldChar, type: 'removed' });
    }
  }

  return segments;
});

/**
 * Computed property for the old value display text
 * @returns {string} Formatted old value or placeholder
 */
const oldValueDisplay = computed(() => {
  return props.oldValue ?? '(empty)';
});

/**
 * Computed property for the new value display text
 * @returns {string} Formatted new value or placeholder
 */
const newValueDisplay = computed(() => {
  return props.newValue ?? '(empty)';
});

/**
 * Toggles the expanded state of the diff view
 * @returns {void}
 */
const toggleExpand = (): void => {
  isExpanded.value = !isExpanded.value;
};
</script>

<template>
  <div class="field-change-diff" :class="{ 'has-change': hasChange }">
    <div class="diff-header" @click="toggleExpand">
      <span class="field-name">{{ displayFieldName }}</span>
      <span v-if="hasChange" class="diff-indicator">
        {{ isExpanded ? '▼' : '▶' }}
      </span>
    </div>

    <div v-if="hasChange" class="diff-content" :class="{ expanded: isExpanded }">
      <div class="diff-row old-value">
        <span class="diff-label">旧值:</span>
        <span class="diff-value old-value-text">{{ oldValueDisplay }}</span>
      </div>

      <div v-if="showDiff && diffSegments.length > 0" class="diff-highlight">
        <span
          v-for="(segment, index) in diffSegments"
          :key="index"
          :class="['diff-char', `diff-${segment.type}`]"
        >
          {{ segment.char }}
        </span>
      </div>

      <div class="diff-row new-value">
        <span class="diff-label">新值:</span>
        <span class="diff-value new-value-text">{{ newValueDisplay }}</span>
      </div>
    </div>

    <div v-else class="no-change">
      <span class="no-change-text">值未变更</span>
    </div>
  </div>
</template>

<style scoped>
.field-change-diff {
  padding: 0.75rem;
  border-radius: 0.375rem;
  background-color: #f9fafb;
  margin-bottom: 0.5rem;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.field-change-diff.has-change {
  background-color: #fffbeb;
  border-color: #fcd34d;
}

.diff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.field-name {
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}

.diff-indicator {
  color: #6b7280;
  font-size: 0.75rem;
}

.diff-content {
  margin-top: 0.5rem;
  display: none;
}

.diff-content.expanded {
  display: block;
}

.diff-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.diff-label {
  width: 3rem;
  color: #6b7280;
  flex-shrink: 0;
}

.diff-value {
  color: #1f2937;
  word-break: break-all;
}

.old-value-text {
  text-decoration: line-through;
  color: #dc2626;
}

.new-value-text {
  color: #059669;
}

.diff-highlight {
  background-color: #fef3c7;
  padding: 0.5rem;
  border-radius: 0.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.8125rem;
  margin: 0.5rem 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.diff-char {
  display: inline;
}

.diff-same {
  color: #6b7280;
}

.diff-added {
  background-color: #dcfce7;
  color: #059669;
  font-weight: 600;
}

.diff-removed {
  background-color: #fee2e2;
  color: #dc2626;
  text-decoration: line-through;
  font-weight: 600;
}

.no-change {
  margin-top: 0.5rem;
  color: #9ca3af;
  font-size: 0.875rem;
  font-style: italic;
}
</style>