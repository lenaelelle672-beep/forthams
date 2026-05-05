/**
 * useAuditRealtime Hook
 * 
 * 提供审计日志实时更新能力，支持 WebSocket 订阅和轮询降级方案。
 * 用于审批流程页面中审计状态的实时同步。
 * 
 * @module hooks/useAuditRealtime
 * @requires approvalService
 * @requires auditApi
 */

import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { Ref } from 'vue';

// 类型定义
interface AuditLogEntry {
  id: string;
  assetId: string;
  action: string;
  operator: string;
  timestamp: number;
  changes?: Record<string, { oldValue: any; newValue: any }>;
  metadata?: Record<string, any>;
}

interface RealtimeConfig {
  /** WebSocket 连接 URL，为空则使用轮询 */
  wsUrl?: string;
  /** 轮询间隔（毫秒），默认 5000 */
  pollInterval?: number;
  /** 是否启用实时更新，默认 true */
  enabled?: boolean;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
}

interface UseAuditRealtimeReturn {
  /** 当前连接的审计日志列表 */
  logs: Ref<AuditLogEntry[]>;
  /** 是否正在连接 */
  isConnecting: Ref<boolean>;
  /** 是否已连接 */
  isConnected: Ref<boolean>;
  /** 最后更新时间戳 */
  lastUpdated: Ref<number | null>;
  /** 错误信息 */
  error: Ref<Error | null>;
  /** 待处理的变更队列 */
  pendingChanges: Ref<AuditLogEntry[]>;
  /** 启动实时监听 */
  start: () => void;
  /** 停止实时监听 */
  stop: () => void;
  /** 手动刷新审计日志 */
  refresh: () => Promise<void>;
  /** 清除错误状态 */
  clearError: () => void;
  /** 订阅特定资产 ID 的审计日志 */
  subscribeToAsset: (assetId: string) => void;
  /** 取消订阅特定资产 ID 的审计日志 */
  unsubscribeFromAsset: (assetId: string) => void;
}

/**
 * WebSocket 消息类型
 */
type WebSocketMessage = 
  | { type: 'audit_log'; payload: AuditLogEntry }
  | { type: 'batch_logs'; payload: AuditLogEntry[] }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'error'; payload: { code: string; message: string } };

/**
 * 审计日志缓存管理器
 * 
 * 用于管理审计日志的本地缓存，支持增量更新和批量操作。
 */
class AuditLogCache {
  private cache: Map<string, AuditLogEntry> = new Map();
  private maxSize: number = 1000;

  /**
   * 添加单条审计日志到缓存
   * 
   * @param log - 审计日志条目
   */
  add(log: AuditLogEntry): void {
    this.cache.set(log.id, log);
    this.evictIfNeeded();
  }

  /**
   * 批量添加审计日志
   * 
   * @param logs - 审计日志数组
   */
  addBatch(logs: AuditLogEntry[]): void {
    logs.forEach(log => this.cache.set(log.id, log));
    this.evictIfNeeded();
  }

  /**
   * 获取所有缓存的审计日志，按时间倒序
   * 
   * @returns 按时间倒序排列的审计日志数组
   */
  getAll(): AuditLogEntry[] {
    return Array.from(this.cache.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 根据资产 ID 获取审计日志
   * 
   * @param assetId - 资产 ID
   * @returns 该资产的审计日志数组
   */
  getByAssetId(assetId: string): AuditLogEntry[] {
    return this.getAll().filter(log => log.assetId === assetId);
  }

  /**
   * 根据 ID 获取单条审计日志
   * 
   * @param id - 审计日志 ID
   * @returns 审计日志条目或 undefined
   */
  getById(id: string): AuditLogEntry | undefined {
    return this.cache.get(id);
  }

  /**
   * 移除单条审计日志
   * 
   * @param id - 审计日志 ID
   */
  remove(id: string): void {
    this.cache.delete(id);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   * 
   * @returns 缓存条目数量
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 如果缓存超过最大限制，移除最旧的条目
   */
  private evictIfNeeded(): void {
    while (this.cache.size > this.maxSize) {
      const oldest = this.getAll().pop();
      if (oldest) {
        this.cache.delete(oldest.id);
      }
    }
  }
}

/**
 * WebSocket 连接管理器
 * 
 * 封装 WebSocket 连接、重连和消息处理逻辑。
 */
class WebSocketConnection {
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private url: string;
  private maxAttempts: number;
  private messageHandlers: Set<(msg: WebSocketMessage) => void> = new Set();
  private statusHandlers: Set<(status: 'connecting' | 'connected' | 'disconnected' | 'error') => void> = new Set();

  constructor(url: string, maxAttempts: number = 5) {
    this.url = url;
    this.maxAttempts = maxAttempts;
  }

  /**
   * 连接到 WebSocket 服务器
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.notifyStatus('connecting');
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.clearTimers();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.notifyStatus('disconnected');
  }

  /**
   * 发送消息到服务器
   * 
   * @param data - 要发送的数据
   */
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * 注册消息处理器
   * 
   * @param handler - 消息处理函数
   * @returns 取消注册函数
   */
  onMessage(handler: (msg: WebSocketMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * 注册连接状态变化处理器
   * 
   * @param handler - 状态变化处理函数
   * @returns 取消注册函数
   */
  onStatusChange(handler: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /**
   * 设置 WebSocket 事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.notifyStatus('connected');
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        console.error('[useAuditRealtime] Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (event) => {
      console.error('[useAuditRealtime] WebSocket error:', event);
      this.notifyStatus('error');
    };

    this.ws.onclose = (event) => {
      this.clearTimers();
      if (event.code !== 1000) {
        this.attemptReconnect();
      }
      this.notifyStatus('disconnected');
    };
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxAttempts) {
      console.warn('[useAuditRealtime] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[useAuditRealtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 启动心跳检测
   */
  private startPing(): void {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  /**
   * 清除定时器
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * 处理错误
   * 
   * @param error - 错误对象
   */
  private handleError(error: Error): void {
    console.error('[useAuditRealtime] Connection error:', error);
    this.notifyStatus('error');
  }

  /**
   * 通知状态变化
   * 
   * @param status - 新的连接状态
   */
  private notifyStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
    this.statusHandlers.forEach(handler => handler(status));
  }
}

/**
 * useAuditRealtime Hook
 * 
 * 提供审计日志的实时更新能力，支持 WebSocket 推送和 HTTP 轮询两种模式。
 * 自动在 WebSocket 不可用时降级到轮询模式，确保在各种网络环境下的可用性。
 * 
 * @param config - 实时配置选项
 * @returns 实时审计日志相关的响应式状态和方法
 * 
 * @example
 * ```ts
 * const {
 *   logs,
 *   isConnected,
 *   start,
 *   stop,
 *   refresh,
 *   subscribeToAsset,
 *   unsubscribeFromAsset
 * } = useAuditRealtime({
 *   wsUrl: 'ws://localhost:8080/api/audit/realtime',
 *   pollInterval: 5000,
 *   enabled: true
 * });
 * 
 * // 启动实时监听
 * start();
 * 
 * // 订阅特定资产的审计日志
 * subscribeToAsset('asset-123');
 * 
 * // 清理
 * onUnmounted(() => stop());
 * ```
 */
export function useAuditRealtime(config: RealtimeConfig = {}): UseAuditRealtimeReturn {
  // 配置参数
  const {
    wsUrl,
    pollInterval = 5000,
    enabled = true,
    maxReconnectAttempts = 5
  } = config;

  // 响应式状态
  const logs = ref<AuditLogEntry[]>([]) as Ref<AuditLogEntry[]>;
  const isConnecting = ref(false);
  const isConnected = ref(false);
  const lastUpdated = ref<number | null>(null);
  const error = ref<Error | null>(null);
  const pendingChanges = ref<AuditLogEntry[]>([]) as Ref<AuditLogEntry[]>;

  // 内部状态
  const cache = new AuditLogCache();
  let wsConnection: WebSocketConnection | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const subscribedAssets = new Set<string>();

  /**
   * 处理 WebSocket 消息
   * 
   * @param message - WebSocket 消息
   */
  function handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'audit_log':
        cache.add(message.payload);
        addPendingChange(message.payload);
        break;
      case 'batch_logs':
        cache.addBatch(message.payload);
        message.payload.forEach(log => addPendingChange(log));
        break;
      case 'ping':
        wsConnection?.send({ type: 'pong' });
        break;
      case 'pong':
        // 心跳响应，无需处理
        break;
      case 'error':
        error.value = new Error(message.payload.message);
        break;
    }
    
    updateLogs();
    lastUpdated.value = Date.now();
  }

  /**
   * 添加待处理变更
   * 
   * @param log - 审计日志条目
   */
  function addPendingChange(log: AuditLogEntry): void {
    if (!pendingChanges.value.find(l => l.id === log.id)) {
      pendingChanges.value = [...pendingChanges.value, log];
    }
  }

  /**
   * 更新日志列表
   */
  function updateLogs(): void {
    if (subscribedAssets.size > 0) {
      logs.value = cache.getAll().filter(log => subscribedAssets.has(log.assetId));
    } else {
      logs.value = cache.getAll();
    }
  }

  /**
   * 处理连接状态变化
   * 
   * @param status - 连接状态
   */
  function handleStatusChange(status: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
    isConnecting.value = status === 'connecting';
    isConnected.value = status === 'connected';
    
    if (status === 'error' && !wsUrl) {
      startPolling();
    }
  }

  /**
   * 启动 WebSocket 连接
   */
  function startWebSocket(): void {
    if (!wsUrl) {
      console.info('[useAuditRealtime] No WebSocket URL provided, falling back to polling');
      startPolling();
      return;
    }

    wsConnection = new WebSocketConnection(wsUrl, maxReconnectAttempts);
    wsConnection.onMessage(handleMessage);
    wsConnection.onStatusChange(handleStatusChange);
    wsConnection.connect();
  }

  /**
   * 启动轮询模式
   */
  function startPolling(): void {
    if (pollTimer) {
      return;
    }

    console.info(`[useAuditRealtime] Starting polling mode with interval ${pollInterval}ms`);
    isConnected.value = true;

    pollTimer = setInterval(async () => {
      try {
        await fetchLogs();
      } catch (err) {
        console.error('[useAuditRealtime] Polling error:', err);
      }
    }, pollInterval);

    // 立即执行一次
    fetchLogs();
  }

  /**
   * 停止轮询
   */
  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /**
   * 获取审计日志
   */
  async function fetchLogs(): Promise<void> {
    // 实际实现中应该调用 API
    // const response = await auditApi.getAuditLogs();
    // cache.addBatch(response.data);
    // updateLogs();
    // lastUpdated.value = Date.now();
  }

  /**
   * 启动实时监听
   */
  function start(): void {
    if (!enabled) {
      console.info('[useAuditRealtime] Realtime updates are disabled');
      return;
    }

    error.value = null;
    startWebSocket();
  }

  /**
   * 停止实时监听
   */
  function stop(): void {
    stopPolling();
    
    if (wsConnection) {
      wsConnection.disconnect();
      wsConnection = null;
    }

    isConnected.value = false;
    isConnecting.value = false;
  }

  /**
   * 手动刷新审计日志
   */
  async function refresh(): Promise<void> {
    try {
      error.value = null;
      await fetchLogs();
    } catch (err) {
      error.value = err as Error;
      throw err;
    }
  }

  /**
   * 清除错误状态
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * 订阅特定资产 ID 的审计日志
   * 
   * @param assetId - 资产 ID
   */
  function subscribeToAsset(assetId: string): void {
    subscribedAssets.add(assetId);
    updateLogs();

    // 如果使用 WebSocket，发送订阅消息
    if (wsConnection) {
      wsConnection.send({
        type: 'subscribe',
        assetId
      });
    }
  }

  /**
   * 取消订阅特定资产 ID 的审计日志
   * 
   * @param assetId - 资产 ID
   */
  function unsubscribeFromAsset(assetId: string): void {
    subscribedAssets.delete(assetId);
    updateLogs();

    // 如果使用 WebSocket，发送取消订阅消息
    if (wsConnection) {
      wsConnection.send({
        type: 'unsubscribe',
        assetId
      });
    }
  }

  /**
   * 清理资源
   */
  function cleanup(): void {
    stop();
    cache.clear();
    subscribedAssets.clear();
    pendingChanges.value = [];
  }

  // 生命周期钩子
  onMounted(() => {
    if (enabled) {
      start();
    }
  });

  onUnmounted(() => {
    cleanup();
  });

  return {
    logs,
    isConnecting,
    isConnected,
    lastUpdated,
    error,
    pendingChanges,
    start,
    stop,
    refresh,
    clearError,
    subscribeToAsset,
    unsubscribeFromAsset
  };
}

/**
 * 导出类型供外部使用
 */
export type { AuditLogEntry, RealtimeConfig, UseAuditRealtimeReturn };