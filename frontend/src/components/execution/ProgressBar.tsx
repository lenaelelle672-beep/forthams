/**
 * @file components/execution/ProgressBar.tsx
 * @description 进度条组件
 */

interface ProgressBarProps {
  percentage: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function ProgressBar({ percentage, showLabel = true, size = 'md' }: ProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const height = size === 'sm' ? 'h-2' : 'h-3';

  function getColor(pct: number): string {
    if (pct >= 100) return 'bg-green-500';
    if (pct >= 60) return 'bg-blue-500';
    if (pct >= 30) return 'bg-amber-500';
    return 'bg-gray-400';
  }

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>进度</span>
          <span>{clampedPercentage}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${height} rounded-full transition-all duration-500 ease-out ${getColor(clampedPercentage)}`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
}
