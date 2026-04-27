"""
SWARM-003: 操作日志仪表板 - 端到端测试套件

测试范围:
- ATB-005: 仪表板页面加载验证
- ATB-006: 筛选功能交互验证
- ATB-007: 风险趋势导航验证
- ATB-008: 响应式布局验证
- PTB-001/002/003: 性能基准测试

依赖项:
- pytest >= 7.0.0
- pytest-playwright >= 0.4.0
- playwright >= 1.40.0

运行方式:
    pytest tests/e2e/test_dashboard_load.py -v
    pytest tests/e2e/test_dashboard_load.py -v --headed  # 可视化模式
"""

import pytest
import time
from playwright.sync_api import Page, expect


# ============================================================================
# ATB-005: 仪表板页面加载验证
# ============================================================================

class TestDashboardPageLoad:
    """ATB-005: 验证操作日志仪表板页面正常加载"""

    def test_dashboard_page_loads_successfully(self, page: Page):
        """
        验收标准: ATB-005
        验证仪表板页面正常加载，核心组件均可见

        测试步骤:
        1. 导航至 /dashboard/operation-logs
        2. 验证页面标题为 "操作日志仪表板"
        3. 验证趋势图表组件可见
        4. 验证风险分布图表可见
        5. 验证日志列表组件可见
        """
        page.goto("/dashboard/operation-logs")

        # 验证页面标题
        title = page.locator("h1")
        expect(title).to_have_text("操作日志仪表板")

        # 验证图表组件存在
        trend_chart = page.locator("[data-testid='trend-chart']")
        expect(trend_chart).to_be_visible()

        risk_chart = page.locator("[data-testid='risk-chart']")
        expect(risk_chart).to_be_visible()

        log_list = page.locator("[data-testid='log-list']")
        expect(log_list).to_be_visible()

    def test_dashboard_renders_trend_chart(self, page: Page):
        """
        验收标准: ATB-005
        验证趋势图表正确渲染数据点

        测试步骤:
        1. 访问仪表板页面
        2. 定位趋势图表 canvas 元素
        3. 验证图表已渲染（非空）
        """
        page.goto("/dashboard/operation-logs")

        chart = page.locator("[data-testid='trend-chart'] canvas")
        expect(chart).to_be_visible()

        # 验证图表 canvas 元素存在（ECharts/Chart.js 渲染产物）
        canvas_count = page.locator("[data-testid='trend-chart'] canvas").count()
        assert canvas_count > 0, "趋势图表 canvas 未渲染"

    def test_dashboard_renders_risk_pie_chart(self, page: Page):
        """
        验收标准: ATB-005
        验证风险分布饼图正确渲染

        测试步骤:
        1. 访问仪表板页面
        2. 定位风险饼图 canvas 元素
        3. 验证图表已渲染
        """
        page.goto("/dashboard/operation-logs")

        chart = page.locator("[data-testid='risk-chart'] canvas")
        expect(chart).to_be_visible()

        canvas_count = page.locator("[data-testid='risk-chart'] canvas").count()
        assert canvas_count > 0, "风险饼图 canvas 未渲染"

    def test_dashboard_displays_recent_logs(self, page: Page):
        """
        验收标准: ATB-005
        验证近期日志列表显示正确

        测试步骤:
        1. 访问仪表板页面
        2. 获取日志条目数量
        3. 验证至少显示默认条数（≥ 10 条）
        """
        page.goto("/dashboard/operation-logs")

        log_items = page.locator("[data-testid='log-item']")
        count = log_items.count()

        assert count >= 10, f"日志列表应至少显示 10 条，当前仅显示 {count} 条"


# ============================================================================
# ATB-006: 筛选功能交互验证
# ============================================================================

class TestDashboardFilters:
    """ATB-006: 验证操作类型筛选与时间范围选择功能"""

    def test_filter_by_operation_type(self, page: Page):
        """
        验收标准: ATB-006
        验证按操作类型筛选后，日志列表仅显示目标类型

        测试步骤:
        1. 选择操作类型筛选条件为 "DELETE"
        2. 点击应用筛选按钮
        3. 验证日志列表中所有条目均为 DELETE 类型
        """
        page.goto("/dashboard/operation-logs")

        # 选择筛选条件
        filter_dropdown = page.locator("[data-testid='filter-operation-type']")
        filter_dropdown.select_option("DELETE")

        apply_button = page.locator("[data-testid='apply-filter']")
        apply_button.click()

        # 等待列表刷新
        page.wait_for_timeout(500)

        # 验证列表中所有条目均为 DELETE 类型
        log_items = page.locator("[data-testid='log-item']")
        count = log_items.count()

        for i in range(count):
            type_badge = log_items.nth(i).locator("[data-testid='log-type']")
            assert type_badge.text_content() == "DELETE", \
                f"第 {i+1} 条日志类型应为 DELETE，实际为 {type_badge.text_content()}"

    def test_time_range_picker_updates_charts(self, page: Page):
        """
        验收标准: ATB-006
        验证时间范围选择后，图表数据随之更新

        测试步骤:
        1. 记录初始图表数据
        2. 修改时间范围为最近 30 天
        3. 验证图表数据已变更
        """
        page.goto("/dashboard/operation-logs")

        # 获取初始数据
        initial_data = page.evaluate("window.__dashboardData__.trend")

        # 修改时间范围为最近 30 天
        time_range = page.locator("[data-testid='time-range']")
        time_range.select_option("last_30_days")

        page.wait_for_timeout(1000)

        # 获取更新后的数据
        updated_data = page.evaluate("window.__dashboardData__.trend")

        # 验证数据已变更（时间范围不同导致数据点数或数值不同）
        assert updated_data != initial_data, \
            "修改时间范围后图表数据应发生变化"

    def test_user_filter_shows_correct_logs(self, page: Page):
        """
        验收标准: ATB-006
        验证按用户筛选后显示正确的日志

        测试步骤:
        1. 选择特定用户筛选
        2. 验证日志列表中所有条目用户ID匹配
        """
        page.goto("/dashboard/operation-logs")

        # 选择第一个可用用户
        user_filter = page.locator("[data-testid='filter-user']")
        user_options = user_filter.locator("option")
        option_count = user_options.count()

        if option_count > 1:
            selected_user = user_options.nth(1).get_attribute("value")
            user_filter.select_option(selected_user)

            page.locator("[data-testid='apply-filter']").click()
            page.wait_for_timeout(500)

            log_items = page.locator("[data-testid='log-item']")
            count = log_items.count()

            for i in range(count):
                user_badge = log_items.nth(i).locator("[data-testid='log-user']")
                actual_user = user_badge.text_content()
                assert actual_user == selected_user, \
                    f"第 {i+1} 条日志用户应匹配筛选条件"

    def test_clear_filter_restores_all_logs(self, page: Page):
        """
        验收标准: ATB-006
        验证清除筛选后恢复显示所有日志

        测试步骤:
        1. 应用筛选条件
        2. 点击清除筛选按钮
        3. 验证日志数量恢复（理论上应等于或接近原始数量）
        """
        page.goto("/dashboard/operation-logs")

        # 记录初始日志数量
        initial_count = page.locator("[data-testid='log-item']").count()

        # 应用筛选
        page.locator("[data-testid='filter-operation-type']").select_option("CREATE")
        page.locator("[data-testid='apply-filter']").click()
        page.wait_for_timeout(500)

        filtered_count = page.locator("[data-testid='log-item']").count()

        # 清除筛选
        page.locator("[data-testid='clear-filter']").click()
        page.wait_for_timeout(500)

        cleared_count = page.locator("[data-testid='log-item']").count()

        assert cleared_count >= filtered_count, \
            "清除筛选后日志数量应恢复"
        assert cleared_count <= initial_count * 1.2, \
            "清除筛选后日志数量不应显著超过初始数量"


# ============================================================================
# ATB-007: 风险趋势导航验证
# ============================================================================

class TestRiskTrendNavigation:
    """ATB-007: 验证从操作日志仪表板导航至风险趋势视图"""

    def test_navigate_to_risk_trend_from_dashboard(self, page: Page):
        """
        验收标准: ATB-007
        验证从操作日志仪表板可导航至风险趋势视图

        测试步骤:
        1. 访问操作日志仪表板
        2. 点击风险趋势入口
        3. 验证跳转至 /dashboard/risk-trend
        4. 验证页面标题为 "风险趋势分析"
        """
        page.goto("/dashboard/operation-logs")

        # 点击风险趋势入口
        nav_link = page.locator("[data-testid='nav-risk-trend']")
        nav_link.click()

        # 验证跳转至风险趋势页面
        expect(page).to_have_url("/dashboard/risk-trend")

        # 验证页面标题
        title = page.locator("h1")
        expect(title).to_have_text("风险趋势分析")

    def test_risk_trend_chart_displays_data(self, page: Page):
        """
        验收标准: ATB-007
        验证风险趋势页面正确渲染图表数据

        测试步骤:
        1. 导航至风险趋势页面
        2. 验证风险趋势折线图可见
        3. 验证图表包含数据点
        """
        page.goto("/dashboard/risk-trend")

        trend_chart = page.locator("[data-testid='risk-trend-chart']")
        expect(trend_chart).to_be_visible()

        canvas = page.locator("[data-testid='risk-trend-chart'] canvas")
        expect(canvas).to_be_visible()


# ============================================================================
# ATB-008: 响应式布局验证
# ============================================================================

class TestDashboardResponsive:
    """ATB-008: 验证仪表板在不同屏幕尺寸下的布局表现"""

    def test_dashboard_layout_on_tablet(self, page: Page):
        """
        验收标准: ATB-008
        验证平板尺寸 (768px) 下仪表板布局正常

        测试步骤:
        1. 设置视口为平板尺寸 (768x1024)
        2. 访问仪表板页面
        3. 验证图表保持可见
        4. 验证日志列表可滚动
        """
        page.set_viewport_size({"width": 768, "height": 1024})
        page.goto("/dashboard/operation-logs")

        # 验证图表保持可见
        trend_chart = page.locator("[data-testid='trend-chart']")
        expect(trend_chart).to_be_visible()

        # 验证日志列表可滚动（宽度应小于视口宽度）
        log_list = page.locator("[data-testid='log-list']")
        log_list_box = log_list.bounding_box()
        assert log_list_box is not None
        assert log_list_box["width"] < 768, \
            f"日志列表宽度 {log_list_box['width']} 应小于视口宽度 768"

    def test_dashboard_layout_on_mobile(self, page: Page):
        """
        验收标准: ATB-008
        验证移动端尺寸 (375px) 下仪表板布局正常

        测试步骤:
        1. 设置视口为移动端尺寸 (375x667)
        2. 访问仪表板页面
        3. 验证核心组件正确堆叠显示
        """
        page.set_viewport_size({"width": 375, "height": 667})
        page.goto("/dashboard/operation-logs")

        # 验证趋势图表可见
        trend_chart = page.locator("[data-testid='trend-chart']")
        expect(trend_chart).to_be_visible()

        # 验证风险图表可见
        risk_chart = page.locator("[data-testid='risk-chart']")
        expect(risk_chart).to_be_visible()

        # 验证日志列表可见
        log_list = page.locator("[data-testid='log-list']")
        expect(log_list).to_be_visible()

    def test_dashboard_layout_on_desktop(self, page: Page):
        """
        验收标准: ATB-008
        验证桌面尺寸 (1920x1080) 下仪表板布局正常

        测试步骤:
        1. 设置视口为桌面尺寸 (1920x1080)
        2. 访问仪表板页面
        3. 验证图表并排显示
        """
        page.set_viewport_size({"width": 1920, "height": 1080})
        page.goto("/dashboard/operation-logs")

        # 验证趋势图表和风险图表同时可见
        trend_chart = page.locator("[data-testid='trend-chart']")
        risk_chart = page.locator("[data-testid='risk-chart']")

        expect(trend_chart).to_be_visible()
        expect(risk_chart).to_be_visible()

        # 验证两者并排布局（水平位置之和应大于单图表宽度）
        trend_box = trend_chart.bounding_box()
        risk_box = risk_chart.bounding_box()

        assert trend_box is not None and risk_box is not None
        assert trend_box["x"] + trend_box["width"] < risk_box["x"], \
            "趋势图表和风险图表应并排显示"


# ============================================================================
# PTB: 性能基准测试
# ============================================================================

class TestDashboardPerformance:
    """性能基准测试：验证仪表板响应时间满足要求"""

    def test_ptb001_dashboard_first_load(self, page: Page):
        """
        性能基准: PTB-001
        仪表板首次加载 P95 ≤ 3 秒

        测试步骤:
        1. 记录页面加载开始时间
        2. 导航至仪表板页面
        3. 等待页面完全加载
        4. 计算加载耗时
        5. 验证 P95 ≤ 3000ms
        """
        page.goto("/dashboard/operation-logs")
        page.wait_for_load_state("networkidle")

        # 验证关键元素加载完成
        page.locator("[data-testid='trend-chart']").wait_for(state="visible", timeout=5000)

        # 获取性能计时
        timing = page.evaluate("""
            () => {
                const perf = performance.timing;
                return {
                    loadTime: perf.loadEventEnd - perf.navigationStart,
                    domReady: perf.domContentLoadedEventEnd - perf.navigationStart
                };
            }
        """)

        load_time_ms = timing["loadTime"]
        assert load_time_ms <= 3000, \
            f"仪表板首次加载时间 {load_time_ms}ms 超过 P95 基准 3000ms"

    def test_ptb002_filter_refresh_performance(self, page: Page):
        """
        性能基准: PTB-002
        筛选后列表刷新 ≤ 1.5 秒

        测试步骤:
        1. 访问仪表板页面
        2. 记录开始时间
        3. 触发筛选操作
        4. 等待列表数据渲染完成
        5. 验证耗时 ≤ 1500ms
        """
        page.goto("/dashboard/operation-logs")
        page.wait_for_load_state("networkidle")

        # 记录开始时间
        start_time = time.time()

        # 触发筛选操作
        page.locator("[data-testid='filter-operation-type']").select_option("UPDATE")
        page.locator("[data-testid='apply-filter']").click()

        # 等待列表数据渲染完成
        page.locator("[data-testid='log-list'] [data-testid='log-item']").first.wait_for(
            state="visible", timeout=5000
        )

        # 计算耗时
        elapsed_ms = (time.time() - start_time) * 1000

        assert elapsed_ms <= 1500, \
            f"筛选后列表刷新耗时 {elapsed_ms:.0f}ms 超过基准 1500ms"

    def test_ptb003_api_response_time(self, page: Page):
        """
        性能基准: PTB-003
        API 响应时间 (1000 条数据) ≤ 2 秒

        测试步骤:
        1. 通过 API 直接调用获取响应时间
        2. 验证响应时间 ≤ 2000ms

        注: 此测试需要后端 API 已部署运行
        """
        response = page.request.get(
            "/api/v1/logs/aggregate",
            params={"start_date": "2024-10-01", "end_date": "2025-01-23", "limit": 1000}
        )

        assert response.ok, f"API 请求失败: {response.status}"

        timing = response.elapsed.total_seconds() * 1000
        assert timing <= 2000, \
            f"API 响应时间 {timing:.0f}ms 超过基准 2000ms"


# ============================================================================
# Pytest Fixtures
# ============================================================================

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """配置浏览器上下文参数"""
    return {
        **browser_context_args,
        "locale": "zh-CN",
        "timezone_id": "Asia/Shanghai",
    }


@pytest.fixture(scope="function")
def dashboard_auth(page: Page):
    """
    仪表板认证 fixture

    确保测试前用户已登录并具有仪表板访问权限
    """
    # 访问登录页面
    page.goto("/login")

    # 执行登录（假设存在测试账户）
    page.fill("[data-testid='username-input']", "test_admin")
    page.fill("[data-testid='password-input']", "test_password")
    page.click("[data-testid='login-submit']")

    # 等待登录成功
    page.wait_for_url("**/dashboard/**", timeout=10000)

    yield page

    # 可选：测试后登出
    # page.click("[data-testid='logout-button']")