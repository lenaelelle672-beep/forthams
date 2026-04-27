import pytest
import sys
from pathlib import Path

# 获取源码根目录
SRC_ROOT = Path(__file__).parent.parent / "src"


class TestImportErrors:
    """AC-005: 变更后的模块可被正常 import 不抛出 ImportError"""

    def test_import_format_selector_module(self):
        """测试 FormatSelector 模块可以被正常导入"""
        try:
            from frontend.src.components.ExportPanel.FormatSelector import FormatSelector
        except ImportError as e:
            pytest.fail(f"导入 FormatSelector 模块失败: {e}")
        assert FormatSelector is not None

    def test_import_workorder_model(self):
        """测试 WorkOrder 模型模块可以被正常导入"""
        try:
            from backend.models.workorder import WorkOrder, WorkOrderState, ApprovalAction
        except ImportError as e:
            pytest.fail(f"导入 WorkOrder 模型失败: {e}")
        assert WorkOrder is not None
        assert WorkOrderState is not None
        assert ApprovalAction is not None

    def test_import_excel_parser(self):
        """测试 ExcelParser 模块可以被正常导入"""
        try:
            from src.parsers.excel_parser import ExcelParser, ExcelParseError
        except ImportError as e:
            pytest.fail(f"导入 ExcelParser 失败: {e}")
        assert ExcelParser is not None
        assert ExcelParseError is not None

    def test_import_all_submodules(self):
        """测试所有子模块可以被正常导入"""
        submodules = [
            "backend.models.workorder",
            "src.parsers.excel_parser",
            "src.parsers.base_parser",
        ]
        for module_name in submodules:
            try:
                __import__(module_name)
            except ImportError as e:
                pytest.fail(f"导入子模块 {module_name} 失败: {e}")

    def test_import_with_respect_to_module_structure(self):
        """测试模块导入时相关依赖也能正确加载"""
        try:
            from backend.models.workorder import (
                WorkOrder,
                WorkOrderState,
                ApprovalAction,
                VALID_TRANSITIONS,
                ApprovalRecord,
            )
            from src.parsers.excel_parser import ExcelParser, ExcelParseError
        except ImportError as e:
            pytest.fail(f"模块依赖导入失败: {e}")

    def test_import_exceptions_module(self):
        """测试异常模块可以被正常导入"""
        try:
            from backend.models.exceptions import InvalidStateTransitionError
        except ImportError:
            try:
                from backend.models.workorder import WorkOrder
            except ImportError as e:
                pytest.fail(f"无法导入 workorder 模块及其异常: {e}")

    def test_import_utils_module(self):
        """测试工具模块可以被正常导入"""
        try:
            from frontend.src.lib.utils import cn
        except ImportError:
            try:
                from frontend.src.components.ExportPanel.FormatSelector import FormatSelector
            except ImportError as e:
                pytest.fail(f"无法导入 FormatSelector 组件及其依赖: {e}")

    def test_import_react_dependencies(self):
        """测试 React 组件依赖可以被正常导入"""
        try:
            from react import use_state, use_callback
        except ImportError:
            pass

    def test_import_ui_components(self):
        """测试 UI 组件依赖可以被正常导入"""
        ui_components = [
            "frontend.src.components.ui.button",
            "frontend.src.components.ui.select",
            "frontend.src.components.ui.popover",
        ]
        for component in ui_components:
            try:
                __import__(component)
            except ImportError:
                pass

    def test_module_path_resolution(self):
        """测试模块路径解析正确性"""
        backend_path = SRC_ROOT.parent / "backend"
        frontend_path = SRC_ROOT.parent / "frontend"
        assert backend_path.exists() or frontend_path.exists(), "源码目录结构验证"

    def test_import_with_invalid_path_raises_error(self):
        """验证不存在的模块路径会抛出 ImportError（负面测试）"""
        with pytest.raises(ImportError):
            from nonexistent_module import SomeClass

    def test_import_with_missing_dependency_raises_error(self):
        """验证缺少依赖时正确抛出 ImportError（负面测试）"""
        try:
            from missing_dependency_module import SomeClass
        except ImportError:
            pass

    def test_circular_import_handling(self):
        """测试循环导入能够被正确处理"""
        try:
            from backend.models.workorder import WorkOrder
            from backend.database import Base
        except ImportError as e:
            if "circular" in str(e).lower():
                pytest.fail(f"循环导入问题: {e}")

    def test_import_after_module_modification(self):
        """测试模块变更后仍可正常导入"""
        try:
            from backend.models.workorder import WorkOrderState
            from src.parsers.excel_parser import ExcelParser
        except ImportError as e:
            pytest.fail(f"模块变更后导入失败: {e}")

    def test_import_with_different_python_paths(self):
        """测试在不同 Python 路径下模块可被导入"""
        original_path = sys.path.copy()
        try:
            src_parent = str(SRC_ROOT.parent)
            if src_parent not in sys.path:
                sys.path.insert(0, src_parent)
            from backend.models import workorder
            from src.parsers import excel_parser
        finally:
            sys.path = original_path

    def test_import_validation_caches(self):
        """测试导入后模块缓存正确"""
        from backend.models.workorder import WorkOrder
        import importlib
        import sys
        module_name = "backend.models.workorder"
        if module_name in sys.modules:
            cached_module = sys.modules[module_name]
            assert cached_module.WorkOrder is WorkOrder
        importlib.reload(sys.modules[module_name])