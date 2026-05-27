/**
 * useAuth Hook — 从 AuthContext 重新导出
 *
 * <p>permissionHooks.ts 及其他模块通过 @/hooks/useAuth 引用本文件。
 * AuthContext.tsx 中定义了核心 useAuth 函数，此处仅做 re-export。</p>
 */
export { useAuth } from '../app/context/AuthContext';
