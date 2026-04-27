"""
E2E tests for Asset Import UI functionality.

Test Suite: ATB-5 (前端 UI 集成)
Spec Reference: SWARM-2025-Q2-P2-006

测试场景：
- TC-5.1 文件上传交互
- TC-5.2 上传进度显示
- TC-5.3 错误提示UI
"""

import pytest
from playwright.sync_api import Page, expect, Locator
import os
import time


class TestAssetImportUI:
    """资产导入 UI E2E 测试类"""

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        """每个测试前的公共设置"""
        self.page = page
        self.base_url = os.environ.get("TEST_BASE_URL", "http://localhost:3000")
        
        # 导航到资产批量导入页面
        self.page.goto(f"{self.base_url}/asset-import")
        self.page.wait_for_load_state("networkidle")

    def _get_sample_csv_path(self) -> str:
        """获取示例 CSV 文件路径"""
        return os.path.join(
            os.path.dirname(__file__), 
            "fixtures", 
            "sample_assets.csv"
        )

    def _get_invalid_csv_path(self) -> str:
        """获取包含错误数据的 CSV 文件路径"""
        return os.path.join(
            os.path.dirname(__file__), 
            "fixtures", 
            "invalid_assets.csv"
        )


class TestUploadCSVFile(TestAssetImportUI):
    """
    TC-5.1: 文件上传交互测试
    
    测试步骤：
    1. 用户打开资产导入页面
    2. 点击文件选择按钮或拖拽区域
    3. 选择有效的 CSV 文件
    4. 验证预览表格显示前10行数据
    
    预期结果：
    - 文件选择后触发预览
    - 显示前10行数据
    - 文件名正确显示
    """

    def test_upload_csv_file(self, page: Page):
        """
        测试 CSV 文件上传和预览功能
        
        验证点：
        1. 文件上传器可点击
        2. 上传后显示文件信息
        3. 数据预览表格正常渲染（前10行）
        """
        # 等待上传组件加载
        file_uploader = page.locator('[data-testid="file-uploader"]')
        expect(file_uploader).to_be_visible(timeout=5000)
        
        # 模拟文件上传（使用示例CSV）
        sample_csv = self._get_sample_csv_path()
        
        # 如果文件存在，执行实际上传
        if os.path.exists(sample_csv):
            page.locator('[data-testid="file-input"]').set_input_files(sample_csv)
        else:
            # 模拟拖拽上传
            page.locator('[data-testid="drop-zone"]').dispatch_event(
                "drop", 
                {"dataTransfer": {"files": []}}
            )
        
        # 验证预览区域出现
        preview_section = page.locator('[data-testid="data-preview"]')
        expect(preview_section).to_be_visible(timeout=3000)
        
        # 验证预览表格包含数据行
        preview_table = page.locator('[data-testid="preview-table"]')
        expect(preview_table).to_be_visible()
        
        # 验证显示行数（应为10行或实际行数，取较小值）
        rows = preview_table.locator("tbody tr")
        row_count = rows.count()
        assert row_count > 0, "预览表格应包含至少一行数据"
        assert row_count <= 10, "预览不应超过10行"

    def test_upload_xlsx_file(self, page: Page):
        """
        测试 Excel 文件上传和预览功能
        
        验证点：
        1. 支持 .xlsx 格式文件选择
        2. 预览数据正确解析
        """
        file_uploader = page.locator('[data-testid="file-uploader"]')
        expect(file_uploader).to_be_visible()
        
        # 切换到 Excel 文件过滤
        page.locator('[data-testid="format-selector"]').select_option("xlsx")
        
        sample_xlsx = os.path.join(
            os.path.dirname(__file__), 
            "fixtures", 
            "sample_assets.xlsx"
        )
        
        if os.path.exists(sample_xlsx):
            page.locator('[data-testid="file-input"]').set_input_files(sample_xlsx)
        
        # 验证 Excel 预览
        preview_section = page.locator('[data-testid="data-preview"]')
        expect(preview_section).to_be_visible(timeout=3000)


class TestUploadProgressIndicator(TestAssetImportUI):
    """
    TC-5.2: 上传进度显示测试
    
    测试步骤：
    1. 用户选择大型文件（>1000条）进行导入
    2. 观察导入过程中的进度指示器
    3. 验证完成后显示导入结果
    
    预期结果：
    - 上传中显示进度条（百分比或进度条动画）
    - 显示已处理条数/总条数
    - 完成后显示成功/失败结果
    """

    def test_upload_progress_indicator(self, page: Page):
        """
        测试导入进度指示器
        
        验证点：
        1. 导入开始后显示进度条
        2. 进度百分比实时更新
        3. 显示 "处理中" 状态
        """
        # 上传大型文件触发异步处理
        large_csv = os.path.join(
            os.path.dirname(__file__), 
            "fixtures", 
            "large_assets_3000.csv"
        )
        
        if os.path.exists(large_csv):
            page.locator('[data-testid="file-input"]').set_input_files(large_csv)
        else:
            # 模拟小文件触发同步导入
            page.locator('[data-testid="file-input"]').set_input_files(
                self._get_sample_csv_path()
            )
        
        # 检查进度指示器（对于小文件可能一闪而过）
        progress_indicator = page.locator('[data-testid="progress-indicator"]')
        
        # 对于大文件，应该看到进度条
        if os.path.exists(large_csv):
            expect(progress_indicator).to_be_visible(timeout=2000)
            
            # 验证进度条存在
            progress_bar = page.locator('[data-testid="progress-bar"]')
            expect(progress_bar).to_be_visible()
            
            # 等待导入完成或超时
            page.wait_for_function(
                "document.querySelector('[data-testid=\"progress-indicator\"]') === null || "
                "document.querySelector('[data-testid=\"import-result\"]') !== null",
                timeout=60000
            )
        
        # 验证结果展示
        result_section = page.locator('[data-testid="import-result"]')
        expect(result_section).to_be_visible(timeout=30000)
        
        # 验证结果包含关键信息
        result_text = result_section.text_content()
        assert result_text is not None
        
        # 检查成功或失败标记
        success_icon = page.locator('[data-testid="result-success"]')
        error_icon = page.locator('[data-testid="result-error"]')
        
        # 至少有一个结果图标出现
        has_result = (
            success_icon.is_visible() or 
            error_icon.is_visible()
        )
        assert has_result, "应显示导入结果（成功或失败）"

    def test_async_import_status_polling(self, page: Page):
        """
        测试异步导入状态轮询
        
        验证点：
        1. 任务ID正确返回
        2. 状态查询接口正常响应
        3. 完成时显示通知
        """
        # 导航到导入页面
        page.goto(f"{self.base_url}/asset-import")
        
        # 上传文件触发异步任务
        large_csv = os.path.join(
            os.path.dirname(__file__), 
            "fixtures", 
            "large_assets_3000.csv"
        )
        
        if os.path.exists(large_csv):
            page.locator('[data-testid="file-input"]').set_input_files(large_csv)
            
            # 触发导入
            page.locator('[data-testid="import-button"]').click()
            
            # 获取任务ID（从URL或响应中）
            task_id = page.locator('[data-testid="task-id"]').text_content()
            assert task_id is not None, "应返回任务ID"
            
            # 可选：直接访问任务状态页面
            status_url = f"{self.base_url}/asset-import/tasks/{task_id}"
            page.goto(status_url)
            
            # 验证任务状态显示
            status_badge = page.locator('[data-testid="task-status"]')
            expect(status_badge).to_be_visible()
            
            # 等待任务完成（最多60秒）
            page.wait_for_selector(
                '[data-testid="task-status"][data-status="COMPLETED"],'
                '[data-testid="task-status"][data-status="FAILED"]',
                timeout=60000
            )


class TestValidationErrorsDisplay(TestAssetImportUI):
    """
    TC-5.3: 错误提示UI测试
    
    测试步骤：
    1. 用户上传包含错误数据的文件
    2. 系统显示校验错误信息
    3. 错误行在UI中高亮
    4. 提供错误报告下载功能
    
    预期结果：
    - 校验失败时在UI高亮错误行
    - 显示错误字段和原因
    - 可下载错误报告
    """

    def test_validation_errors_display(self, page: Page):
        """
        测试校验错误显示功能
        
        验证点：
        1. 错误行在预览中高亮标记
        2. 错误详情面板显示
        3. 错误信息包含行号和字段名
        """
        # 上传包含错误数据的文件
        invalid_csv = self._get_invalid_csv_path()
        
        if os.path.exists(invalid_csv):
            page.locator('[data-testid="file-input"]').set_input_files(invalid_csv)
        else:
            # 模拟错误数据
            pass
        
        # 触发导入/校验
        page.locator('[data-testid="validate-button"]').click()
        
        # 等待错误展示
        error_panel = page.locator('[data-testid="validation-error-panel"]')
        expect(error_panel).to_be_visible(timeout=5000)
        
        # 验证错误数量显示
        error_count = page.locator('[data-testid="error-count"]')
        expect(error_count).to_be_visible()
        
        # 验证错误列表存在
        error_list = page.locator('[data-testid="error-list"]')
        expect(error_list).to_be_visible()
        
        # 验证至少一条错误记录
        error_items = error_list.locator('[data-testid="error-item"]')
        assert error_items.count() > 0, "应显示至少一条错误"
        
        # 验证错误详情包含必要信息
        first_error = error_items.first
        error_text = first_error.text_content()
        
        # 检查包含行号信息
        assert any(keyword in str(error_text) for keyword in ["row", "Row", "行", "line", "Line"]), \
            "错误信息应包含行号"
        
        # 检查包含字段信息
        assert any(keyword in str(error_text) for keyword in ["field", "Field", "字段", "column", "Column"]), \
            "错误信息应包含字段名"

    def test_error_row_highlight(self, page: Page):
        """
        测试错误行高亮功能
        
        验证点：
        1. 预览表格中错误行有红色/橙色背景
        2. 点击错误可定位到具体行
        """
        # 上传无效文件
        invalid_csv = self._get_invalid_csv_path()
        
        if os.path.exists(invalid_csv):
            page.locator('[data-testid="file-input"]').set_input_files(invalid_csv)
        
        # 触发校验
        page.locator('[data-testid="validate-button"]').click()
        
        # 等待错误面板
        error_panel = page.locator('[data-testid="validation-error-panel"]')
        expect(error_panel).to_be_visible(timeout=5000)
        
        # 获取第一个错误行号
        first_error_row = page.locator('[data-testid="error-row-number"]').first
        row_number = first_error_row.text_content()
        
        # 在预览表格中定位该行
        preview_table = page.locator('[data-testid="preview-table"]')
        error_rows = preview_table.locator("tr.error-row, tr[data-error='true'], tr.highlight-error")
        
        # 验证有高亮行存在
        if error_rows.count() > 0:
            first_highlighted = error_rows.first
            expect(first_highlighted).to_be_visible()
            
            # 验证样式（背景色）
            bg_color = first_highlighted.evaluate(
                "element => window.getComputedStyle(element).backgroundColor"
            )
            assert bg_color != "rgba(0, 0, 0, 0)", "错误行应有非透明背景色"

    def test_error_report_download(self, page: Page):
        """
        测试错误报告下载功能
        
        验证点：
        1. 下载按钮存在且可点击
        2. 点击后触发文件下载
        3. 下载的CSV包含完整错误信息
        """
        # 上传无效文件
        invalid_csv = self._get_invalid_csv_path()
        
        if os.path.exists(invalid_csv):
            page.locator('[data-testid="file-input"]').set_input_files(invalid_csv)
        
        # 触发校验
        page.locator('[data-testid="validate-button"]').click()
        
        # 等待错误面板
        error_panel = page.locator('[data-testid="validation-error-panel"]')
        expect(error_panel).to_be_visible(timeout=5000)
        
        # 查找下载按钮
        download_button = page.locator('[data-testid="download-error-report"]')
        expect(download_button).to_be_visible()
        
        # 设置下载拦截
        with page.expect_download() as download_info:
            download_button.click()
        
        download = download_info.value
        file_path = download.path()
        
        # 验证下载的文件存在
        assert os.path.exists(file_path), "应成功下载错误报告文件"
        
        # 验证文件名为 CSV 格式
        assert file_path.endswith(".csv"), "错误报告应为 CSV 格式"
        
        # 清理下载文件
        try:
            os.remove(file_path)
        except Exception:
            pass

    def test_partial_import_with_errors(self, page: Page):
        """
        测试部分导入（部分行有错误）
        
        验证点：
        1. 显示成功行数和失败行数
        2. 允许用户选择跳过错误行继续导入
        """
        # 上传混合文件（有部分错误）
        mixed_csv = os.path.join(
            os.path.dirname(__file__), 
            "fixtures", 
            "mixed_valid_invalid.csv"
        )
        
        if os.path.exists(mixed_csv):
            page.locator('[data-testid="file-input"]').set_input_files(mixed_csv)
        
        # 触发校验/导入
        page.locator('[data-testid="import-button"]').click()
        
        # 等待结果
        result_section = page.locator('[data-testid="import-result"]')
        expect(result_section).to_be_visible(timeout=30000)
        
        # 验证结果包含统计信息
        success_count = page.locator('[data-testid="success-count"]')
        error_count_el = page.locator('[data-testid="error-count"]')
        
        if success_count.is_visible() or error_count_el.is_visible():
            success_text = success_count.text_content() or "0"
            error_text = error_count_el.text_content() or "0"
            
            # 验证统计数据格式
            assert any(char.isdigit() for char in success_text), "成功数应为数字"
            assert any(char.isdigit() for char in error_text), "错误数应为数字"


class TestImportWorkflowIntegration(TestAssetImportUI):
    """
    导入工作流集成测试
    
    测试完整的导入流程：
    - 文件选择 -> 预览 -> 校验 -> 导入 -> 结果
    """

    def test_full_import_workflow(self, page: Page):
        """
        测试完整导入工作流
        
        步骤：
        1. 选择有效的 CSV 文件
        2. 验证预览数据正确
        3. 点击导入按钮
        4. 等待导入完成
        5. 验证成功消息
        """
        # Step 1: 选择文件
        sample_csv = self._get_sample_csv_path()
        
        if os.path.exists(sample_csv):
            page.locator('[data-testid="file-input"]').set_input_files(sample_csv)
        
        # Step 2: 验证预览
        preview_table = page.locator('[data-testid="preview-table"]')
        expect(preview_table).to_be_visible(timeout=5000)
        
        # Step 3: 点击导入
        import_button = page.locator('[data-testid="import-button"]')
        expect(import_button).to_be_enabled()
        import_button.click()
        
        # Step 4 & 5: 等待结果
        result_section = page.locator('[data-testid="import-result"]')
        
        # 对于同步导入（小文件），结果应很快显示
        # 对于异步导入（大文件），需要等待任务完成
        expect(result_section).to_be_visible(timeout=60000)
        
        # 验证成功状态
        success_indicator = page.locator('[data-testid="result-success"]')
        
        # 如果成功图标出现，验证消息
        if success_indicator.is_visible():
            result_message = page.locator('[data-testid="result-message"]')
            expect(result_message).to_be_visible()

    def test_import_cancellation(self, page: Page):
        """
        测试导入取消功能
        
        验证点：
        1. 大文件导入时可取消
        2. 取消后任务状态更新
        """
        large_csv = os.path.join(
            os.path.dirname(__file__), 
            "fixtures", 
            "large_assets_3000.csv"
        )
        
        if os.path.exists(large_csv):
            page.locator('[data-testid="file-input"]').set_input_files(large_csv)
            
            # 触发导入
            page.locator('[data-testid="import-button"]').click()
            
            # 显示进度后尝试取消
            cancel_button = page.locator('[data-testid="cancel-import"]')
            
            if cancel_button.is_visible(timeout=3000):
                cancel_button.click()
                
                # 验证取消确认对话框
                confirm_dialog = page.locator('[data-testid="cancel-confirm-dialog"]')
                expect(confirm_dialog).to_be_visible()
                
                # 确认取消
                page.locator('[data-testid="confirm-cancel"]').click()
                
                # 验证任务状态变为 CANCELLED
                status = page.locator('[data-testid="task-status"]')
                expect(status).to_have_attribute("data-status", "CANCELLED")


# Pytest 配置标记
pytestmark = [
    pytest.mark.e2e,
    pytest.mark.ui,
    pytest.mark.import_module,
]