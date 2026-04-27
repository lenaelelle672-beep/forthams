/**
 * @fileoverview 资产盘点管理主页面 (InventoryPage)
 *
 * 左右分栏布局：左侧为盘点任务列表（320px 固定宽度），右侧为任务执行详情页或空状态占位。
 *
 * 路由映射：
 *   - /inventory              → 任务列表 + 空状态占位
 *   - /inventory/tasks/:taskId → 任务列表 + 任务详情
 *
 * 通过 React Router URL 参数 (:taskId) 驱动右侧面板内容切换，
 * 支持浏览器前进/后退和 URL 书签。
 *
 * 响应式：视窗宽度 < 768px 时自动切换为上下堆叠布局。
 * 权限守卫：无盘点权限用户重定向至 403 页面。
 *
 * @see SWARM-P3-010-FE 资产盘点管理前端 Spec
 * @Layer Layer 4 — 页面集成与路由
 */

import React, { useState, useCallback } from 'react';
import { Button, Breadcrumb, Empty, Grid, Typography } from 'antd';
import {
  PlusOutlined,
  HomeOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, Navigate } from 'react-router-dom';

// 组件导入 — 子组件定义在 src/components/inventory/ 下
import TaskList from '@/components/inventory/TaskList';
import CreateTaskModal from '@/components/inventory/CreateTaskModal';
import TaskDetailPage from '@/components/inventory/TaskDetailPage';

// 状态管理 — Zustand store（客户端 UI 状态）
import { useInventoryStore } from '@/stores/useInventoryStore';

const { Text } = Typography;

// ─── 样式常量 ─────────────────────────────────────────────────

/** 左侧面板固定宽度（桌面端） */
const LEFT_PANEL_WIDTH = 320;

/** 面包屑栏高度（近似值，用于计算内容区高度） */
const BREADCRUMB_HEIGHT = 49;

/** 响应式断点：md = 768px */
const MOBILE_BREAKPOINT = 'md';

// ─── 主组件 ───────────────────────────────────────────────────

/**
 * 资产盘点管理主页面组件
 *
 * 职责：
 * 1. 渲染左右分栏布局（桌面端）或上下堆叠布局（移动端 <768px）
 * 2. 通过 React Router URL 参数 (taskId) 驱动右侧面板渲染
 * 3. 管理新建任务弹窗的打开/关闭状态
 * 4. 权限守卫：无盘点权限用户重定向至 403 页面
 * 5. 面包屑导航：盘点管理 > 任务详情
 *
 * @component
 * @returns {React.ReactElement} 盘点管理主页面
 */
const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const screens = Grid.useBreakpoint();

  /** 新建任务弹窗可见性状态 */
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);

  /** 从 Zustand store 获取盘点模块权限标志 */
  const hasPermission = useInventoryStore((state) => state.hasPermission);

  // ─── 权限守卫 ────────────────────────────────────────────────
  if (hasPermission === false) {
    return <Navigate to="/403" replace />;
  }

  // ─── 响应式判断 ──────────────────────────────────────────────
  /** 视窗宽度 < 768px 时使用移动端布局 */
  const isMobile: boolean = !screens[MOBILE_BREAKPOINT];

  // ─── 事件处理器 ──────────────────────────────────────────────

  /**
   * 处理任务列表中的任务点击事件
   * 将选中的 taskId 推入浏览器 URL，驱动右侧面板渲染详情
   *
   * @param id - 被点击的盘点任务唯一标识
   */
  const handleTaskSelect = useCallback(
    (id: string) => {
      navigate(`/inventory/tasks/${id}`);
    },
    [navigate],
  );

  /**
   * 新建盘点任务成功回调
   * 关闭弹窗并自动导航至新创建任务的详情页
   *
   * @param newTaskId - 后端返回的新建任务唯一标识
   */
  const handleCreateSuccess = useCallback(
    (newTaskId: string) => {
      setCreateModalOpen(false);
      navigate(`/inventory/tasks/${newTaskId}`);
    },
    [navigate],
  );

  /**
   * 关闭新建盘点任务弹窗
   */
  const handleCreateModalClose = useCallback(() => {
    setCreateModalOpen(false);
  }, []);

  // ─── 面包屑数据 ──────────────────────────────────────────────

  /** 根据当前路由构建面包屑导航项 */
  const breadcrumbItems = [
    {
      title: (
        <>
          <HomeOutlined /> 首页
        </>
      ),
    },
    {
      title: '盘点管理',
    },
    ...(taskId ? [{ title: '任务详情' }] : []),
  ];

  // ─── 子渲染函数 ──────────────────────────────────────────────

  /**
   * 渲染左侧面板头部区域
   * 包含"盘点任务"标题和"新建盘点"按钮
   */
  const renderPanelHeader = (): React.ReactElement => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottom: '1px solid #f0f0f0',
        position: 'sticky',
        top: 0,
        background: '#fff',
        zIndex: 1,
      }}
    >
      <Text strong style={{ fontSize: 16 }}>
        <AuditOutlined style={{ marginRight: 8 }} />
        盘点任务
      </Text>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setCreateModalOpen(true)}
        aria-label="新建盘点任务"
      >
        新建盘点
      </Button>
    </div>
  );

  /**
   * 渲染右侧内容区域
   * 当 URL 中包含 taskId 时渲染任务详情页，否则显示空状态占位
   */
  const renderContent = (): React.ReactElement =>
    taskId ? (
      <TaskDetailPage taskId={taskId} />
    ) : (
      <Empty
        style={{ marginTop: 200 }}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span>
            请从左侧列表选择一个盘点任务，
            <br />
            或点击「新建盘点」创建新任务
          </span>
        }
      />
    );

  // ─── 主体渲染 ────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#f5f5f5',
        overflow: 'hidden',
      }}
    >
      {/* ─── 面包屑导航栏 ─── */}
      <div
        style={{
          flexShrink: 0,
          padding: `12px 24px`,
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
        }}
        aria-label="面包屑导航"
      >
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* ─── 主内容区：左侧任务列表 + 右侧详情 ─── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden',
        }}
      >
        {/* ── 左侧面板：盘点任务列表 ── */}
        <div
          style={
            isMobile
              ? {
                  flexShrink: 0,
                  maxHeight: '50vh',
                  background: '#fff',
                  borderBottom: '1px solid #f0f0f0',
                  overflowY: 'auto',
                }
              : {
                  width: LEFT_PANEL_WIDTH,
                  flexShrink: 0,
                  background: '#fff',
                  borderRight: '1px solid #f0f0f0',
                  overflowY: 'auto',
                }
          }
        >
          {renderPanelHeader()}
          <TaskList
            onTaskSelect={handleTaskSelect}
            selectedTaskId={taskId}
          />
        </div>

        {/* ── 右侧面板：任务详情 / 空状态 ── */}
        <div
          style={
            isMobile
              ? {
                  flex: 1,
                  background: '#fff',
                  overflowY: 'auto',
                }
              : {
                  flex: 1,
                  background: '#fff',
                  overflowY: 'auto',
                }
          }
        >
          {renderContent()}
        </div>
      </div>

      {/* ─── 新建盘点任务弹窗 ─── */}
      <CreateTaskModal
        open={createModalOpen}
        onClose={handleCreateModalClose}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};

export default InventoryPage;