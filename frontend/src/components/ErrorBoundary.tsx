/**
 * @file components/ErrorBoundary.tsx
 * @description 全局错误边界 — 捕获子组件渲染期间的未处理异常
 *
 * 用法：
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 * 可选 fallback prop 自定义错误 UI；省略则显示内置降级页面。
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (fallback) return fallback(error, this.reset);

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-2">页面加载出错</h2>
          <p className="text-sm text-slate-400 mb-1 max-w-sm">
            {error.message || '发生了一个意外错误'}
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-3 text-left text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3 max-w-lg w-full overflow-auto max-h-32">
              {error.stack}
            </pre>
          )}
          <button
            onClick={this.reset}
            className="mt-5 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
