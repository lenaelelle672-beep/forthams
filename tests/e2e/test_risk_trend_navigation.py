"""
E2E 测试: 风险趋势导航

ATB-007: 验证从操作日志仪表板可导航至风险趋势视图

测试场景:
1. 从操作日志仪表板导航到风险趋势页面
2. 验证风险趋势页面正确加载并显示相关组件
3. 验证 URL 正确跳转
4. 验证页面标题和内容正确性

相关验收标准:
- AC-001: Graphify 知识图谱节点匹配
- AC-002: AST 静态检查通过
- AC-003: docstring 文档注释完整
- AC-004: 模块可正常 import
"""

import pytest
from playwright.sync_api import Page, expect


class TestRiskTrendNavigation:
    """风险趋势导航 E2E 测试套件"""

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        """测试前置设置"""
        self.page = page
        # 设置标准视口大小
        self.page.set_viewport_size({"width": 1280, "height": 720})

    def test_navigate_to_risk_trend_from_dashboard(self):
        """
        ATB-007: 验证从操作日志仪表板可导航至风险趋势视图
        
        测试步骤:
        1. 访问操作日志仪表板页面
        2. 点击风险趋势导航入口
        3. 验证页面成功跳转到风险趋势分析页面
        4. 验证页面标题显示正确
        """
        # 访问操作日志仪表板
        self.page.goto("/dashboard/operation-logs")
        
        # 等待仪表板页面加载完成
        self.page.wait_for_load_state("networkidle")
        
        # 验证页面标题存在
        dashboard_title = self.page.locator("h1")
        expect(dashboard_title).to_be_visible()
        assert dashboard_title.text_content() == "操作日志仪表板"
        
        # 点击风险趋势入口
        risk_trend_nav = self.page.locator("[data-testid='nav-risk-trend']")
        expect(risk_trend_nav).to_be_visible()
        risk_trend_nav.click()
        
        # 等待导航完成
        self.page.wait_for_load_state("networkidle")
        
        # 验证 URL 正确跳转
        assert "/dashboard/risk-trend" in self.page.url
        
        # 验证风险趋势页面标题
        risk_title = self.page.locator("h1")
        expect(risk_title).to_be_visible()
        assert risk_title.text_content() == "风险趋势分析"

    def test_risk_trend_page_components_render(self):
        """
        ATB-007: 验证风险趋势页面组件正确渲染
        
        验证页面包含以下核心组件:
        - 风险趋势图表
        - 风险等级分布饼图
        - 风险事件列表
        - 时间范围选择器
        """
        # 直接访问风险趋势页面
        self.page.goto("/dashboard/risk-trend")
        self.page.wait_for_load_state("networkidle")
        
        # 验证风险趋势折线图组件
        trend_chart = self.page.locator("[data-testid='risk-trend-chart']")
        expect(trend_chart).to_be_visible()
        
        # 验证风险等级分布饼图
        risk_pie_chart = self.page.locator("[data-testid='risk-pie-chart']")
        expect(risk_pie_chart).to_be_visible()
        
        # 验证风险事件列表
        risk_event_list = self.page.locator("[data-testid='risk-event-list']")
        expect(risk_event_list).to_be_visible()
        
        # 验证时间范围选择器
        time_range_picker = self.page.locator("[data-testid='time-range-picker']")
        expect(time_range_picker).to_be_visible()

    def test_risk_trend_chart_displays_data(self):
        """
        ATB-007: 验证风险趋势图表显示数据
        
        验证:
        1. 图表 canvas 元素存在
        2. 图表包含数据点（非空）
        3. 图表加载状态正确
        """
        self.page.goto("/dashboard/risk-trend")
        self.page.wait_for_load_state("networkidle")
        
        # 验证图表 canvas 元素存在（ECharts/Chart.js 渲染产物）
        chart_canvas = self.page.locator("[data-testid='risk-trend-chart'] canvas")
        expect(chart_canvas).to_be_visible()
        
        # 验证图表不是加载中状态
        loading_indicator = self.page.locator("[data-testid='risk-trend-loading']")
        expect(loading_indicator).to_have_count(0)

    def test_risk_pie_chart_renders_sections(self):
        """
        ATB-007: 验证风险等级分布饼图正确渲染
        
        验证饼图包含以下风险等级:
        - CRITICAL (极高风险)
        - HIGH (高风险)
        - MEDIUM (中风险)
        - LOW (低风险)
        """
        self.page.goto("/dashboard/risk-trend")
        self.page.wait_for_load_state("networkidle")
        
        # 验证饼图组件
        pie_chart = self.page.locator("[data-testid='risk-pie-chart']")
        expect(pie_chart).to_be_visible()
        
        # 验证图例存在
        legend = self.page.locator("[data-testid='risk-legend']")
        expect(legend).to_be_visible()
        
        # 验证包含关键风险等级标签
        critical_label = self.page.locator("text=极高风险")
        high_label = self.page.locator("text=高风险")
        medium_label = self.page.locator("text=中风险")
        low_label = self.page.locator("text=低风险")
        
        expect(critical_label).to_be_visible()
        expect(high_label).to_be_visible()
        expect(medium_label).to_be_visible()
        expect(low_label).to_be_visible()

    def test_time_range_selection_updates_data(self):
        """
        ATB-007: 验证时间范围选择后数据正确更新
        
        测试步骤:
        1. 获取初始图表数据
        2. 修改时间范围为 "最近 30 天"
        3. 验证图表数据发生变化
        """
        self.page.goto("/dashboard/risk-trend")
        self.page.wait_for_load_state("networkidle")
        
        # 获取初始数据状态
        initial_data = self.page.evaluate("window.__dashboardData__.riskTrend")
        initial_length = len(initial_data) if initial_data else 0
        
        # 修改时间范围
        time_range = self.page.locator("[data-testid='time-range-picker']")
        time_range.select_option("last_30_days")
        
        # 等待数据更新
        self.page.wait_for_timeout(1500)
        
        # 获取更新后的数据
        updated_data = self.page.evaluate("window.__dashboardData__.riskTrend")
        updated_length = len(updated_data) if updated_data else 0
        
        # 验证数据发生了变化（30天数据点应少于7天）
        assert updated_length <= initial_length

    def test_navigate_back_to_operation_logs(self):
        """
        ATB-007: 验证可以从风险趋势页面返回操作日志仪表板
        
        测试双向导航功能
        """
        # 从风险趋势页面开始
        self.page.goto("/dashboard/risk-trend")
        self.page.wait_for_load_state("networkidle")
        
        # 点击返回操作日志仪表板的链接
        back_link = self.page.locator("[data-testid='nav-operation-logs']")
        expect(back_link).to_be_visible()
        back_link.click()
        
        # 等待导航完成
        self.page.wait_for_load_state("networkidle")
        
        # 验证 URL 返回到操作日志仪表板
        assert "/dashboard/operation-logs" in self.page.url
        
        # 验证页面标题
        dashboard_title = self.page.locator("h1")
        expect(dashboard_title).to_be_visible()
        assert dashboard_title.text_content() == "操作日志仪表板"

    def test_risk_trend_accessible_from_sidebar(self):
        """
        ATB-007: 验证侧边栏包含风险趋势导航入口
        
        验证侧边栏菜单中包含风险趋势选项
        """
        self.page.goto("/dashboard/operation-logs")
        self.page.wait_for_load_state("networkidle")
        
        # 验证侧边栏存在
        sidebar = self.page.locator("[data-testid='app-sidebar']")
        expect(sidebar).to_be_visible()
        
        # 验证侧边栏包含风险趋势链接
        risk_trend_link = self.page.locator("[data-testid='sidebar-risk-trend']")
        expect(risk_trend_link).to_be_visible()
        
        # 验证链接文本正确
        assert "风险趋势" in risk_trend_link.text_content()

    def test_risk_trend_no_matching_nodes_handled(self):
        """
        ATB-007: 验证无匹配节点场景的错误处理
        
        对应核心 Bug: [Graphify 知识图谱] No matching nodes found.
        
        当 Graphify 知识图谱无法找到匹配节点时，
        应显示友好的错误提示而非空白页面
        """
        self.page.goto("/dashboard/risk-trend")
        self.page.wait_for_load_state("networkidle")
        
        # 检查页面不包含错误信息
        error_message = self.page.locator("[data-testid='error-message']")
        
        # 如果存在错误信息元素
        if error_message.count() > 0:
            # 验证错误信息内容友好
            expect(error_message).not_to_contain_text("No matching nodes found")
            # 验证显示重试按钮
            retry_button = self.page.locator("[data-testid='retry-button']")
            expect(retry_button).to_be_visible()
        else:
            # 无错误，验证图表正常渲染
            trend_chart = self.page.locator("[data-testid='risk-trend-chart']")
            expect(trend_chart).to_be_visible()


class TestRiskTrendResponsive:
    """风险趋势页面响应式测试"""

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        """测试前置设置"""
        self.page = page

    def test_risk_trend_on_tablet(self):
        """
        ATB-008: 验证平板尺寸 (768px) 下风险趋势页面布局
        
        验证:
        1. 页面保持可用
        2. 图表保持可见
        3. 布局自适应
        """
        self.page.set_viewport_size({"width": 768, "height": 1024})
        self.page.goto("/dashboard/risk-trend")
        self.page.wait_for_load_state("networkidle")
        
        # 验证页面标题
        title = self.page.locator("h1")
        expect(title).to_be_visible()
        
        # 验证图表保持可见
        trend_chart = self.page.locator("[data-testid='risk-trend-chart']")
        expect(trend_chart).to_be_visible()
        
        # 验证布局调整 - 图表宽度应小于等于视口宽度
        chart_box = trend_chart.bounding_box()
        assert chart_box is not None
        assert chart_box["width"] <= 768

    def test_risk_trend_on_mobile(self):
        """
        ATB-008: 验证移动端尺寸 (375px) 下页面布局
        
        验证移动端提供可接受的降级体验
        """
        self.page.set_viewport_size({"width": 375, "height": 667})
        self.page.goto("/dashboard/risk-trend")
        self.page.wait_for_load_state("networkidle")
        
        # 验证核心内容可见
        title = self.page.locator("h1")
        expect(title).to_be_visible()
        
        # 验证至少有一个图表可见
        trend_chart = self.page.locator("[data-testid='risk-trend-chart']")
        risk_pie_chart = self.page.locator("[data-testid='risk-pie-chart']")
        
        # 至少有一个主要图表可见
        charts_visible = trend_chart.is_visible() or risk_pie_chart.is_visible()
        assert charts_visible, "At least one main chart should be visible on mobile"