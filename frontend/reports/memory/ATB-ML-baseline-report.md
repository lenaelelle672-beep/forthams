# SWARM-002 Memory Profiling Baseline Report

**任务编号**: SWARM-002  
**审计维度**: 内存泄漏风险 (P2 - 高)  
**生成时间**: 2024-XX-XX  
**状态**: 待执行

---

## 1. 内存测试范围

| 测试用例 ID | 目标函数 | 描述 | 检测方法 | 阈值 |
|------------|---------|-----|---------|-----|
| ATB-ML-001 | `generateGraphifyNodes` | 循环引用风险 | 代码审查 + Jest 内存测试 | 无意外闭包持有 |
| ATB-ML-002 | `validateGraphifyNodes` | 遍历大数组 | `v8.getHeapStatistics()` 差值 | 内存增长 ≤ 100KB/10000次 |
| ATB-ML-003 | GraphifyKnowledgeGraph | React 组件泄漏 | React DevTools Profiler | 无 detached DOM 节点 |
| ATB-ML-004 | 多次调用 | 累积 Set 增长 | 多次调用对比 size | Set size 符合预期 |
| ATB-ML-005 | 渲染大数据集 | Canvas/SVG 内存 | Chrome DevTools Memory | 无内存持续增长 |

---

## 2. 目标函数内存分析

### 2.1 `generateGraphifyNodes` (3 处实现)

| 文件位置 | 行号 | Set 使用 | 闭包风险 |
|---------|------|---------|---------|
| `frontend/src/hooks/useAuditLogs.ts` | L447 | `nodeIdSet = new Set<string>()` | 低 - 无循环引用 |
| `frontend/src/pages/AssetDetailPage/hooks/useAuditLogs.ts` | L419 | `nodeIdSet = new Set<string>()` | 低 - 无循环引用 |
| `frontend/src/hooks/useAuditLog.ts` | L195 | 无 Set | 低 |

**风险点**: `nodeIdSet` 在循环中持续增长，需验证 `Set.delete()` 在适当时机被调用。

### 2.2 `validateGraphifyNodes` (2 处实现)

| 文件位置 | 行号 | 数组遍历方式 | 内存风险 |
|---------|------|-------------|---------|
| `frontend/src/hooks/useAuditLog.ts` | L286 | `nodes.every()` | 低 - 短路求值 |
| `frontend/src/pages/AssetDetailPage/hooks/useAuditableFields.ts` | L520 | `nodes.every()` | 低 - 短路求值 |

### 2.3 `convertAuditLogsToGraphifyNodes`

| 文件位置 | 行号 | 节点数组构建 | 内存风险 |
|---------|------|-------------|---------|
| `frontend/src/hooks/useAuditLog.ts` | L195 | `nodes.push()` | 中 - 大数据集需分页 |

---

## 3. 内存测试配置

```javascript
// jest.config.js 内存测试配置
{
  testMatch: ['**/tests/unit/memory/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup-memory.ts'],
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
}
```

### 测试环境要求

```bash
# Node.js 内存测试启动参数
node --expose-gc --max-old-space-size=512 \
  node_modules/.bin/jest tests/unit/memory/ --runInBand
```

---

## 4. 预期输出格式

### 4.1 内存增长报告 (ATB-ML-002)

```
Memory Delta Report
===================
Function: validateGraphifyNodes
Iterations: 10000
Input Size: 1000 nodes per iteration
Memory Before: XXX bytes
Memory After: XXX bytes
Delta: XXX bytes
Threshold: 102400 bytes (100KB)
Status: PASS/FAIL
```

### 4.2 Set 累积测试报告 (ATB-ML-004)

```
Set Growth Report
=================
Function: generateGraphifyNodes
Initial Size: 0
After 100 calls: XXX
Expected Size: XXX
Status: PASS/FAIL
```

---

## 5. 执行命令

```bash
# Phase 4: 内存泄漏专项测试
cd frontend

# 4.1 执行内存剖析测试
node --expose-gc -e "
const v8 = require('v8');
const { generateGraphifyNodes } = require('./src/hooks/useAuditLogs.ts');

const before = v8.getHeapStatistics();
for(let i = 0; i < 1000; i++) {
  generateGraphifyNodes(generateTestLogs(100));
  if (i % 100 === 0) gc();
}
const after = v8.getHeapStatistics();
console.log('Memory delta:', after.used_heap_size - before.used_heap_size);
"

# 4.2 生成内存报告
npx jest tests/unit/memory/ --coverage --json --outputFile=reports/memory/memory-test-results.json
```

---

## 6. 验收标准

| 指标 | 阈值 | 状态 |
|-----|------|------|
| 单次函数调用内存增长 | ≤ 10KB | 待验证 |
| 10000 次调用累积增长 | ≤ 100KB | 待验证 |
| Set 数据结构正确释放 | 无泄漏 | 待验证 |
| React 组件无 detached DOM | 0 个 | 待验证 |

---

**报告状态**: 待执行测试后更新