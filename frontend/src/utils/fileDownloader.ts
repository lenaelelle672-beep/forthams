/**
 * @module fileDownloader
 * @description Blob 文件下载工具函数
 *
 * 提供 Blob + URL.createObjectURL 方式触发浏览器文件下载，
 * 下载完成后立即调用 URL.revokeObjectURL 释放内存，
 * 确保不发生内存泄漏。
 */

/**
 * 使用 Blob + URL.createObjectURL 触发浏览器文件下载。
 *
 * 流程：
 *  1. 调用 URL.createObjectURL(blob) 创建临时下载链接
 *  2. 创建隐藏 <a> 元素并设置 href / download 属性
 *  3. 模拟点击触发下载
 *  4. 移除 <a> 元素并调用 URL.revokeObjectURL 释放内存
 *
 * @param {Blob} blob - 要下载的 Blob 数据
 * @param {string} filename - 浏览器保存时使用的文件名
 *
 * @example
 * // ATB-017: 验证 URL.revokeObjectURL 被调用
 * const blob = new Blob(['content'], { type: 'application/octet-stream' });
 * downloadBlob(blob, 'test.xlsx');
 */
export function downloadBlob(blob: Blob, filename: string): void {
  // Step 1: 创建临时 Object URL
  const url = URL.createObjectURL(blob);

  // Step 2: 创建隐藏 <a> 元素
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  // Step 3: 添加到 DOM 并触发点击下载
  document.body.appendChild(link);
  link.click();

  // Step 4: 清理 DOM 节点并释放 Object URL 内存
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 生成导出文件名，格式为：资产台账_YYYYMMDD_HHmmss.xlsx
 *
 * 时间戳取前端当前时间，与 spec 交互约束一致：
 * - 导出文件名格式为 `资产台账_YYYYMMDD_HHmmss.xlsx`
 *
 * @returns {string} 格式化的导出文件名
 *
 * @example
 * // 假设当前时间为 2025-07-12 15:30:45
 * generateExportFilename(); // → "资产台账_20250712_153045.xlsx"
 */
export function generateExportFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `资产台账_${year}${month}${day}_${hours}${minutes}${seconds}.xlsx`;
}