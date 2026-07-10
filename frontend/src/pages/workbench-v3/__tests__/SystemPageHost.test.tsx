import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SystemPageHost from '../SystemPageHost';

describe('SystemPageHost 建设中占位页', () => {
  it('待接入菜单展示后端就绪状态徽章与建设计划', () => {
    render(
      <SystemPageHost activeMenu="system-doc-center" activeMenuLabel="文档中心" />,
    );
    // 后端状态徽章（doc-center 是后端零实现）
    expect(screen.getByText('后端零实现')).toBeInTheDocument();
    // 计划阶段徽章
    expect(screen.getByText('计划 P2')).toBeInTheDocument();
    // 后端现状与建设计划区块存在
    expect(screen.getByText(/后端现状/)).toBeInTheDocument();
    expect(screen.getByText(/建设计划/)).toBeInTheDocument();
  });

  it('后端零实现的菜单展示红色徽章', () => {
    render(
      <SystemPageHost activeMenu="system-doc-center" activeMenuLabel="文档中心" />,
    );
    expect(screen.getByText('后端零实现')).toBeInTheDocument();
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
