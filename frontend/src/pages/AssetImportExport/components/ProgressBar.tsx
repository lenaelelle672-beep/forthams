/**
 * ProgressBar 组件
 *
 * 用于资产批量导入流程中展示上传进度与当前阶段状态的可视化进度条。
 *
 * 支持的生命周期阶段：
 *   idle       → 初始空闲态，不渲染进度条
 *   uploading  → 正在上传，根据 percent 驱动进度条填充
 *   parsing    → 上传完成，后端正在解析，进度条锁定 100% 并显示脉冲动画
 *   preview    → 解析完成进入预览，进度条消失
 *   submitting → 用户确认提交入库中，进度条以不确定态展示
 *
 * @module AssetImportExport/components/ProgressBar
 */

import React from 'react';

/** 导入生命周期阶段枚举 */
export type ImportPhase =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'preview'
  | 'submitting';

/** ProgressBar 组件属性 */
export interface ProgressBarProps {
  /** 当前导入阶段，默认 'idle' */
  phase: ImportPhase;
  /** 上传百分比 (0-100)，仅在 phase 为 'uploading' 时有意义 */
  percent: number;
  /** 可选的自定义状态文本，为空时组件根据 phase 自动生成 */
  statusText?: string;
  /** 可选的错误信息，传入后进度条切换为红色错误态 */
  errorMessage?: string;
}

/** 根据 phase 生成默认状态文本 */
function getDefaultStatusText(phase: ImportPhase): string {
  switch (phase) {
    case 'uploading':
      return '文件上传中…';
    case 'parsing':
      return '上传完成，正在解析文件内容…';
    case 'submitting':
      return '正在提交数据…';
    case 'preview':
    case 'idle':
    default:
      return '';
  }
}

/**
 * ProgressBar 组件
 *
 * 根据当前导入阶段 (phase) 渲染不同形态的进度条：
 * - **idle / preview**：不渲染任何内容。
 * - **uploading**：渲染带百分比数值的填充进度条，宽度由 `percent` 控制。
 * - **parsing**：进度条固定在 100%，叠加 CSS 脉冲动画表示等待解析结果。
 * - **submitting**：不确定进度条（indeterminate），使用 CSS 动画模拟左右滑动。
 * - 若 `errorMessage` 不为空：进度条以红色错误样式渲染，显示错误文本。
 *
 * @param props - ProgressBarProps
 * @returns React.ReactElement | null
 */
const ProgressBar: React.FC<ProgressBarProps> = ({
  phase,
  percent,
  statusText,
  errorMessage,
}) => {
  // idle 和 preview 阶段不需要显示进度条
  if (phase === 'idle' || phase === 'preview') {
    return null;
  }

  const hasError = Boolean(errorMessage);
  const displayText = hasError
    ? errorMessage!
    : (statusText ?? getDefaultStatusText(phase));

  // 将 percent 限制在 0~100 范围内
  const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));

  /** 是否为不确定进度（submitting 阶段） */
  const isIndeterminate = phase === 'submitting';

  /** 是否处于 parsing 阶段（100% 且等待后端） */
  const isParsing = phase === 'parsing';

  // ── 动态 class 名称 ──────────────────────────────────
  const containerClass = [
    'progress-bar-container',
    hasError ? 'progress-bar--error' : '',
    isParsing ? 'progress-bar--parsing' : '',
    isIndeterminate ? 'progress-bar--indeterminate' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass} role="progressbar" aria-valuenow={clampedPercent} aria-valuemin={0} aria-valuemax={100}>
      {/* 状态文本 */}
      {displayText && (
        <div className="progress-bar__status-text">{displayText}</div>
      )}

      {/* 进度轨道 */}
      <div className="progress-bar__track">
        {/* 确定进度的填充条 */}
        {!isIndeterminate && (
          <div
            className="progress-bar__fill"
            style={{ width: `${isParsing ? 100 : clampedPercent}%` }}
          />
        )}

        {/* 不确定进度条：用伪元素动画（这里放一个空 div 作为动画载体） */}
        {isIndeterminate && <div className="progress-bar__indeterminate-slider" />}
      </div>

      {/* 百分比标签（仅 uploading 阶段显示） */}
      {phase === 'uploading' && (
        <div className="progress-bar__percent-label">{clampedPercent}%</div>
      )}
    </div>
  );
};

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;