import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SystemPageHost from '../SystemPageHost';

describe('SystemPageHost 建设中占位页', () => {
  it('无真组件时展示基础占位文案（44 项已全量接入，无 pending 元数据）', () => {
    render(
      <SystemPageHost activeMenu="system-tech-support" activeMenuLabel="技术支持" />,
    );
    // tech-support 已接入，但未传 RealPage 时仍显示占位兜底
    expect(screen.getByText('该菜单尚未接入 Workbench V3 真组件')).toBeInTheDocument();
    // pendingMenuStatus 已清空（44/44 全量接入），不再有后端现状区块
    expect(screen.queryByText(/后端现状/)).not.toBeInTheDocument();
  });

  it('未登记状态元数据的菜单仍展示基础占位文案', () => {
    render(
      <SystemPageHost activeMenu="some-unknown-menu" activeMenuLabel="未知菜单" />,
    );
    expect(screen.getByText('该菜单尚未接入 Workbench V3 真组件')).toBeInTheDocument();
    expect(screen.queryByText('后端现状')).not.toBeInTheDocument();
  });

  it('RealPage 存在时渲染真组件而非占位', () => {
    const RealPage = () => <div data-testid="real-page">真实组件</div>;
    render(
      <SystemPageHost activeMenu="system-user-management" activeMenuLabel="用户管理" RealPage={RealPage as never} />,
    );
    expect(screen.getByTestId('real-page')).toBeInTheDocument();
    expect(screen.queryByText('建设中')).not.toBeInTheDocument();
  });
});
