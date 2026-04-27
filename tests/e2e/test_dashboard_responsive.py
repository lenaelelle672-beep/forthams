"""
ATB-008: 操作日志仪表板响应式布局验证

测试平板尺寸 (768px) 下仪表板布局是否正常渲染。

对应验收标准: AC-001 (响应式布局)
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture
def authenticated_page(page: Page) -> Page:
    """
    认证会话 fixture。
    
    Returns:
        Page: 已登录认证的浏览器页面
    """
    page.goto("/login")
    page.fill("[data-testid='username-input']", "admin")
    page.fill("[data-testid='password-input']", "admin123")
    page.click("[data-testid='login-submit']")
    page.wait_for_url("**/dashboard**")
    return page


class TestDashboardResponsive:
    """
    操作日志仪表板响应式布局测试套件。
    
    测试场景:
    - ATB-008: 平板尺寸 (768px) 下仪表板布局正常
    """
    
    def test_dashboard_layout_on_tablet(self, authenticated_page: Page):
        """
        ATB-008: 验证平板尺寸 (768px) 下仪表板布局正常
        
        测试步骤:
        1. 设置视口为平板尺寸 (768x1024)
        2. 导航至操作日志仪表板
        3. 验证图表组件保持可见
        4. 验证日志列表宽度小于视口宽度（允许横向滚动）
        
        验收基准:
        - 趋势图表在平板尺寸下可见
        - 日志列表宽度自适应或可滚动
        """
        page = authenticated_page
        
        # Step 1: 设置平板视口尺寸
        page.set_viewport_size({"width": 768, "height": 1024})
        
        # Step 2: 导航至操作日志仪表板
        page.goto("/dashboard/operation-logs")
        page.wait_for_load_state("networkidle")
        
        # Step 3: 验证趋势图表可见
        trend_chart = page.locator("[data-testid='trend-chart']")
        expect(trend_chart).to_be_visible()
        
        # 额外验证: 图表在平板宽度内
        chart_box = trend_chart.bounding_box()
        assert chart_box is not None, "趋势图表未正确渲染"
        assert chart_box["width"] <= 768, "图表宽度超出视口"
        
        # Step 4: 验证风险分布图表可见
        risk_chart = page.locator("[data-testid='risk-chart']")
        expect(risk_chart).to_be_visible()
        
        # Step 5: 验证日志列表组件
        log_list = page.locator("[data-testid='log-list']")
        expect(log_list).to_be_visible()
        
        # 验证日志列表宽度小于或等于视口（自适应或可滚动）
        log_list_box = log_list.bounding_box()
        assert log_list_box is not None, "日志列表未正确渲染"
        assert log_list_box["width"] <= 768, "日志列表宽度超出视口"
        
    def test_dashboard_elements_not_overlap_on_tablet(self, authenticated_page: Page):
        """
        ATB-008 扩展: 验证平板尺寸下组件无重叠
        
        测试平板 (768px) 布局中图表和列表之间的间距是否合理，
        确保组件之间没有重叠。
        """
        page = authenticated_page
        page.set_viewport_size({"width": 768, "height": 1024})
        page.goto("/dashboard/operation-logs")
        page.wait_for_load_state("networkidle")
        
        # 获取趋势图表边界
        trend_chart = page.locator("[data-testid='trend-chart']")
        trend_box = trend_chart.bounding_box()
        
        # 获取风险图表边界
        risk_chart = page.locator("[data-testid='risk-chart']")
        risk_box = risk_chart.bounding_box()
        
        # 获取日志列表边界
        log_list = page.locator("[data-testid='log-list']")
        log_list_box = log_list.bounding_box()
        
        # 验证所有组件已渲染
        assert trend_box is not None, "趋势图表未渲染"
        assert risk_box is not None, "风险图表未渲染"
        assert log_list_box is not None, "日志列表未渲染"
        
        # 验证组件 Y 轴位置递增（无垂直重叠）
        assert trend_box["y"] < risk_box["y"], "趋势图表与风险图表存在垂直重叠"
        assert risk_box["y"] < log_list_box["y"], "风险图表与日志列表存在垂直重叠"
        
        # 验证组件之间有合理间距（至少 8px）
        assert (risk_box["y"] - (trend_box["y"] + trend_box["height"])) >= 8, \
            "趋势图表与风险图表间距过小"
        assert (log_list_box["y"] - (risk_box["y"] + risk_box["height"])) >= 8, \
            "风险图表与日志列表间距过小"
    
    def test_dashboard_scroll_behavior_on_tablet(self, authenticated_page: Page):
        """
        ATB-008 扩展: 验证平板尺寸下垂直滚动行为
        
        测试当仪表板内容超出视口高度时，垂直滚动是否正常工作。
        """
        page = authenticated_page
        page.set_viewport_size({"width": 768, "height": 1024})
        page.goto("/dashboard/operation-logs")
        page.wait_for_load_state("networkidle")
        
        # 获取页面整体高度
        body = page.locator("body")
        body_box = body.bounding_box()
        viewport_height = 1024
        
        # 验证页面高度是否超过视口（需要滚动）
        if body_box and body_box["height"] > viewport_height:
            # 执行滚动操作
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(300)  # 等待滚动完成
            
            # 验证可以滚动到底部（页面高度足够）
            scroll_top = page.evaluate("window.pageYOffset + window.innerHeight")
            document_height = page.evaluate("document.body.scrollHeight")
            
            assert scroll_top >= document_height - 50, \
                "页面滚动行为异常，无法到达页面底部"
        else:
            pytest.skip("页面内容未超出视口，无需滚动测试")
    
    def test_dashboard_text_legibility_on_tablet(self, authenticated_page: Page):
        """
        ATB-008 扩展: 验证平板尺寸下文字可读性
        
        确保在 768px 宽度下，图表标签和日志条目文字清晰可读，
        不会出现文字被截断或过小的情况。
        """
        page = authenticated_page
        page.set_viewport_size({"width": 768, "height": 1024})
        page.goto("/dashboard/operation-logs")
        page.wait_for_load_state("networkidle")
        
        # 检查页面标题
        heading = page.locator("h1")
        expect(heading).to_be_visible()
        assert len(heading.text_content() or "") > 0, "页面标题为空"
        
        # 检查图表标签容器是否存在
        chart_labels = page.locator("[data-testid='trend-chart'] canvas")
        expect(chart_labels).to_be_visible()
        
        # 检查日志列表条目
        log_items = page.locator("[data-testid='log-item']")
        if log_items.count() > 0:
            first_item = log_items.first
            # 验证日志条目有内容
            expect(first_item).to_be_visible()
            
            # 检查日志类型标签
            type_badge = first_item.locator("[data-testid='log-type']")
            expect(type_badge).to_be_visible()
            type_text = type_badge.text_content()
            assert type_text and len(type_text) > 0, "日志类型标签为空"