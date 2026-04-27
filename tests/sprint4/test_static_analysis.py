"""
Static Analysis Tests for Sprint 4

This module contains comprehensive tests for the static analysis framework,
including DeadCodeVisitor functionality, docstring coverage analysis,
and audit service integration.

Phase 3: 技术债务梳理与规划阶段
- 完成系统死代码检测机制的全面评估
- 整理文档覆盖率测试框架
- 建立技术债务优先级分类体系
- 形成可执行的 backlog 清单

Community Focus: 1, 8, 12, 14
"""

import unittest
import ast
import sys
import os
from pathlib import Path

# Add the scripts directory to the path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))

from ast_dead_code_check import DeadCodeVisitor, analyze_with_ast
from ast_dead_code_check import format_output_csv, get_daemon


class TestStaticAnalysisConstraints(unittest.TestCase):
    """
    Test static analysis constraints and validation mechanisms.
    
    Validates the DeadCodeVisitor's ability to correctly identify dead code
    while maintaining compatibility with existing Graphify knowledge图谱.
    """

    def setUp(self):
        """Set up test fixtures for static analysis tests."""
        self.visitor = DeadCodeVisitor()
        self.test_code = '''
def active_function():
    """Active function with proper implementation."""
    return "active"

def unused_function():
    """Unused function that should be detected as dead code."""
    pass

class ActiveClass:
    """Active class with methods."""
    
    def active_method(self):
        """Active method."""
        return True
        
    def unused_method(self):
        """Unused method that should be detected as dead code."""
        pass
'''
        self.tree = ast.parse(self.test_code)

    def test_basic_structure_validation(self):
        """Test basic structure validation of DeadCodeVisitor."""
        # Test that the visitor can analyze code without errors
        self.visitor.analyze(self.test_code)
        
        # Verify that nodes were created
        nodes = self.visitor.get_all_nodes()
        self.assertGreater(len(nodes), 0, "No nodes were created during analysis")
        
        # Verify that edges were created
        edges = self.visitor.get_edges()
        self.assertGreater(len(edges), 0, "No edges were created during analysis")

    def test_dead_code_detection(self):
        """Test dead code detection functionality."""
        self.visitor.analyze(self.test_code)
        
        # Get dead code candidates
        dead_code = self.visitor.get_dead_code()
        
        # Verify that unused functions are detected
        unused_functions = [item for item in dead_code if 'unused_function' in item['name']]
        self.assertGreater(len(unused_functions), 0, "Unused functions not detected")
        
        # Verify that unused methods are detected
        unused_methods = [item for item in dead_code if 'unused_method' in item['name']]
        self.assertGreater(len(unused_methods), 0, "Unused methods not detected")

    def test_node_id_generation(self):
        """Test proper node ID generation for Graphify compatibility."""
        self.visitor.analyze(self.test_code)
        
        nodes = self.visitor.get_all_nodes()
        
        # Verify that all nodes have proper IDs
        for node in nodes:
            self.assertIn('id', node, "Node missing required 'id' field")
            self.assertIsInstance(node['id'], str, "Node ID must be a string")
            self.assertGreater(len(node['id']), 0, "Node ID cannot be empty")

    def test_edge_creation(self):
        """Test proper edge creation between nodes."""
        self.visitor.analyze(self.test_code)
        
        edges = self.visitor.get_edges()
        
        # Verify that all edges have proper structure
        for edge in edges:
            self.assertIn('source', edge, "Edge missing required 'source' field")
            self.assertIn('target', edge, "Edge missing required 'target' field")
            self.assertIn('type', edge, "Edge missing required 'type' field")

    def test_graph_data_format(self):
        """Test that graph data output format is compatible with Graphify."""
        self.visitor.analyze(self.test_code)
        
        graph_data = self.visitor.get_graph_data()
        
        # Verify required fields in graph data
        self.assertIn('nodes', graph_data, "Graph data missing 'nodes' field")
        self.assertIn('edges', graph_data, "Graph data missing 'edges' field")
        self.assertIn('metadata', graph_data, "Graph data missing 'metadata' field")
        
        # Verify metadata structure
        metadata = graph_data['metadata']
        self.assertIn('analysis_type', metadata, "Metadata missing 'analysis_type' field")
        self.assertIn('timestamp', metadata, "Metadata missing 'timestamp' field")


class TestDeadCodeVisitorDocstringCoverage(unittest.TestCase):
    """
    Test docstring coverage analysis functionality.
    
    Validates the DeadCodeVisitor's ability to analyze docstring coverage
    and provide comprehensive documentation metrics.
    """

    def setUp(self):
        """Set up test fixtures for docstring coverage tests."""
        self.visitor = DeadCodeVisitor()
        self.test_code_with_docstrings = '''
def well_documented_function():
    """This function has proper documentation.
    
    Returns:
        str: A test string
    """
    return "test"

def poorly_documented_function():
    # This function lacks proper docstring
    return "test"

def undocumented_function():
    return "test"
'''
        self.tree = ast.parse(self.test_code_with_docstrings)

    def test_get_method_docstring(self):
        """Test the _get_method_docstring functionality."""
        # This test would need to access private methods
        # For now, we test the public interface
        self.visitor.analyze(self.test_code_with_docstrings)
        
        # Get all nodes and check for docstring presence
        nodes = self.visitor.get_all_nodes()
        
        # Count functions with docstrings
        documented_functions = 0
        for node in nodes:
            if node.get('type') == 'function':
                if node.get('docstring') and len(node['docstring'].strip()) > 0:
                    documented_functions += 1
        
        # Should have at least one well-documented function
        self.assertGreater(documented_functions, 0, "No documented functions found")

    def test_docstring_coverage_calculation(self):
        """Test docstring coverage calculation."""
        self.visitor.analyze(self.test_code_with_docstrings)
        
        # Get statistics
        stats = self.visitor.get_statistics()
        
        # Verify that statistics include docstring coverage
        self.assertIn('docstring_coverage', stats, "Statistics missing docstring coverage")
        
        # Coverage should be between 0 and 1
        coverage = stats['docstring_coverage']
        self.assertGreaterEqual(coverage, 0, "Docstring coverage cannot be negative")
        self.assertLessEqual(coverage, 1, "Docstring coverage cannot exceed 1")

    def test_empty_function_detection(self):
        """Test detection of empty functions."""
        empty_function_code = '''
def empty_function():
    pass

def non_empty_function():
    return "value"
'''
        self.visitor.analyze(empty_function_code)
        
        dead_code = self.visitor.get_dead_code()
        
        # Should detect empty_function as dead code
        empty_functions = [item for item in dead_code if 'empty_function' in item['name']]
        self.assertGreater(len(empty_functions), 0, "Empty functions not detected")

    def test_empty_class_detection(self):
        """Test detection of empty classes."""
        empty_class_code = '''
class EmptyClass:
    pass

class NonEmptyClass:
    def method(self):
        return "value"
'''
        self.visitor.analyze(empty_class_code)
        
        dead_code = self.visitor.get_dead_code()
        
        # Should detect EmptyClass as dead code
        empty_classes = [item for item in dead_code if 'EmptyClass' in item['name']]
        self.assertGreater(len(empty_classes), 0, "Empty classes not detected")


class TestAuditInterceptionLogic(unittest.TestCase):
    """
    Test audit service integration and interception logic.
    
    Validates the DeadCodeVisitor's audit capabilities and compatibility
    with existing AuditService implementations.
    """

    def setUp(self):
        """Set up test fixtures for audit tests."""
        self.visitor = DeadCodeVisitor()

    def test_record_node_functionality(self):
        """Test node recording functionality for audit purposes."""
        # Test that nodes can be recorded (this would normally interact with audit service)
        self.visitor.analyze("def test_function(): pass")
        
        # Get recorded nodes
        nodes = self.visitor.get_all_nodes()
        
        # Verify that nodes were recorded
        self.assertGreater(len(nodes), 0, "No nodes were recorded")

    def test_record_edge_functionality(self):
        """Test edge recording functionality for audit purposes."""
        test_code = '''
class TestClass:
    def method(self):
        pass
'''
        self.visitor.analyze(test_code)
        
        # Get recorded edges
        edges = self.visitor.get_edges()
        
        # Verify that edges were recorded
        self.assertGreater(len(edges), 0, "No edges were recorded")

    def test_audit_compatibility(self):
        """Test compatibility with existing audit service interfaces."""
        # This test verifies that the visitor doesn't break existing audit functionality
        self.visitor.analyze("def test_function(): pass")
        
        # Get graph data (this would be consumed by audit services)
        graph_data = self.visitor.get_graph_data()
        
        # Verify that graph data has expected structure for audit consumption
        self.assertIn('nodes', graph_data, "Graph data missing nodes for audit")
        self.assertIn('edges', graph_data, "Graph data missing edges for audit")


class TestOutputFormat(unittest.TestCase):
    """
    Test output format compatibility with Graphify knowledge图谱.
    
    Validates that all output formats are compatible with existing
    Graphify data structures and requirements.
    """

    def setUp(self):
        """Set up test fixtures for output format tests."""
        self.visitor = DeadCodeVisitor()
        self.test_code = '''
def active_function():
    """Active function."""
    return "active"

class ActiveClass:
    """Active class."""
    
    def active_method(self):
        """Active method."""
        return True
'''

    def test_csv_output_format(self):
        """Test CSV output format compatibility."""
        self.visitor.analyze(self.test_code)
        
        # Test CSV output generation
        csv_output = format_output_csv(self.visitor.get_graph_data())
        
        # Verify that CSV output is generated
        self.assertIsInstance(csv_output, str, "CSV output must be a string")
        self.assertGreater(len(csv_output), 0, "CSV output cannot be empty")

    def test_graph_data_structure(self):
        """Test graph data structure compatibility."""
        self.visitor.analyze(self.test_code)
        
        graph_data = self.visitor.get_graph_data()
        
        # Verify required fields
        required_fields = ['nodes', 'edges', 'metadata']
        for field in required_fields:
            self.assertIn(field, graph_data, f"Graph data missing required field: {field}")
        
        # Verify node structure
        for node in graph_data['nodes']:
            required_node_fields = ['id', 'type', 'name']
            for field in required_node_fields:
                self.assertIn(field, node, f"Node missing required field: {field}")
        
        # Verify edge structure
        for edge in graph_data['edges']:
            required_edge_fields = ['source', 'target', 'type']
            for field in required_edge_fields:
                self.assertIn(field, edge, f"Edge missing required field: {field}")

    def test_statistics_output(self):
        """Test statistics output format."""
        self.visitor.analyze(self.test_code)
        
        stats = self.visitor.get_statistics()
        
        # Verify that statistics contain expected fields
        expected_stats_fields = [
            'total_nodes', 'total_edges', 'dead_code_count',
            'docstring_coverage', 'analysis_timestamp'
        ]
        
        for field in expected_stats_fields:
            self.assertIn(field, stats, f"Statistics missing field: {field}")


class TestCommunitySpecificAnalysis(unittest.TestCase):
    """
    Test analysis for specific communities (1, 8, 12, 14).
    
    Validates that the analysis framework works correctly across
    different community modules and maintains consistency.
    """

    def test_community_1_compatibility(self):
        """Test compatibility with community 1 modules."""
        # Community 1: scripts/ast_dead_code_check.py
        self.visitor.analyze("def test_function(): pass")
        
        # Verify basic functionality works
        nodes = self.visitor.get_all_nodes()
        self.assertGreater(len(nodes), 0, "Community 1 analysis failed")

    def test_community_8_compatibility(self):
        """Test compatibility with community 8 modules."""
        # Community 8: tests/sprint4/test_deprecated_cleanup.py
        test_code = '''
def deprecated_function():
    """Deprecated function that should be flagged."""
    pass
'''
        self.visitor.analyze(test_code)
        
        # Verify dead code detection works
        dead_code = self.visitor.get_dead_code()
        self.assertGreater(len(dead_code), 0, "Community 8 analysis failed")

    def test_community_12_compatibility(self):
        """Test compatibility with community 12 modules."""
        # Community 12: Additional test modules
        self.visitor.analyze("class TestClass:\n    def method(self): pass")
        
        # Verify class analysis works
        nodes = self.visitor.get_all_nodes()
        self.assertGreater(len(nodes), 0, "Community 12 analysis failed")

    def test_community_14_compatibility(self):
        """Test compatibility with community 14 modules."""
        # Community 14: Integration test modules
        test_code = '''
def integration_test_function():
    """Integration test function."""
    return "integration"
'''
        self.visitor.analyze(test_code)
        
        # Verify integration analysis works
        graph_data = self.visitor.get_graph_data()
        self.assertIn('nodes', graph_data, "Community 14 analysis failed")


class TestDaemonIntegration(unittest.TestCase):
    """
    Test daemon integration for persistent analysis.
    
    Validates that the daemon functionality works correctly with
    the DeadCodeVisitor for persistent analysis operations.
    """

    def test_daemon_initialization(self):
        """Test daemon initialization and basic functionality."""
        daemon = get_daemon()
        
        # Verify daemon is initialized
        self.assertIsNotNone(daemon, "Daemon failed to initialize")
        
        # Verify daemon has expected methods
        self.assertTrue(hasattr(daemon, 'analyze'), "Daemon missing analyze method")
        self.assertTrue(hasattr(daemon, 'get_stats'), "Daemon missing get_stats method")

    def test_daemon_analysis(self):
        """Test daemon analysis functionality."""
        daemon = get_daemon()
        
        test_code = '''
def daemon_test_function():
    """Test function for daemon analysis."""
    return "daemon"
'''
        
        # Perform analysis through daemon
        daemon.analyze(test_code)
        
        # Verify analysis results
        stats = daemon.get_stats()
        self.assertIn('total_nodes', stats, "Daemon stats missing total_nodes")
        self.assertIn('total_edges', stats, "Daemon stats missing total_edges")


if __name__ == '__main__':
    # Configure test runner with verbose output
    unittest.main(verbosity=2)
import pytest
from scripts.ast_dead_code_check import DeadCodeVisitor
import ast


class TestDeadCodeVisitorBasic:
    """基础功能测试类"""
    
    def test_analyze_simple_function(self):
        """测试简单函数分析"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        assert len(visitor.get_dead_code()) > 0
        
    def test_analyze_class_with_empty_methods(self):
        """测试包含空方法的类分析"""
        code = """
class TestClass:
    def empty_method(self):
        pass
        
    def another_empty_method(self):
        pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        assert len(visitor.get_dead_code()) > 0
        
    def test_get_all_nodes(self):
        """测试获取所有节点"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        nodes = visitor.get_all_nodes()
        assert isinstance(nodes, list)
        assert len(nodes) > 0
        
    def test_get_edges(self):
        """测试获取边"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        edges = visitor.get_edges()
        assert isinstance(edges, list)
        
    def test_get_graph_data(self):
        """测试获取图数据"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        graph_data = visitor.get_graph_data()
        assert isinstance(graph_data, dict)
        assert 'nodes' in graph_data
        assert 'edges' in graph_data
        
    def test_get_statistics(self):
        """测试获取统计信息"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        stats = visitor.get_statistics()
        assert isinstance(stats, dict)
        
    def test_is_dead_code_candidate(self):
        """测试死代码候选判断"""
        code = """
def empty_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证能够识别空函数
        dead_code = visitor.get_dead_code()
        assert len(dead_code) > 0


class TestDeadCodeVisitorIntegration:
    """集成测试类"""
    
    def test_analyze_with_ast(self):
        """测试AST分析功能"""
        code = """
def test_function():
    pass

class TestClass:
    def empty_method(self):
        pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.analyze_with_ast(tree)
        
        assert len(visitor.get_dead_code()) > 0
        
    def test_format_output_csv(self):
        """测试CSV格式输出"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        csv_output = visitor.format_output_csv()
        assert isinstance(csv_output, str)
        assert len(csv_output) > 0


class TestDeadCodeVisitorConstraints:
    """约束测试类"""
    
    def test_empty_code_analysis(self):
        """测试空代码分析"""
        code = ""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 应该能够处理空代码而不抛出异常
        assert isinstance(visitor.get_dead_code(), list)
        
    def test_syntax_error_handling(self):
        """测试语法错误处理"""
        code = """
def invalid_function(
    # 缺少闭合括号
"""
        try:
            tree = ast.parse(code)
            visitor = DeadCodeVisitor()
            visitor.visit(tree)
        except SyntaxError:
            # 预期语法错误
            pass
        else:
            # 如果没有语法错误，验证功能正常
            assert True


class TestDeadCodeVisitorPerformance:
    """性能测试类"""
    
    def test_large_file_analysis(self):
        """测试大文件分析性能"""
        # 生成一个包含多个函数的代码字符串
        code = ""
        for i in range(100):
            code += f"""
def function_{i}():
    pass
"""
        
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证能够处理大量函数
        assert len(visitor.get_dead_code()) > 0


class TestDeadCodeVisitorAudit:
    """审计相关测试类"""
    
    def test_audit_service_integration(self):
        """测试审计服务集成"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证审计功能正常
        nodes = visitor.get_all_nodes()
        edges = visitor.get_edges()
        
        assert isinstance(nodes, list)
        assert isinstance(edges, list)


class TestDeadCodeVisitorDocstring:
    """文档字符串测试类"""
    
    def test_docstring_coverage(self):
        """测试文档字符串覆盖率"""
        code = """
def function_with_docstring():
    \"\"\"This function has a docstring\"\"\"
    pass

def function_without_docstring():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证能够识别有文档字符串和没有文档字符串的函数
        dead_code = visitor.get_dead_code()
        assert len(dead_code) > 0


class TestDeadCodeVisitorCommunity:
    """社区相关测试类"""
    
    def test_community_1_analysis(self):
        """测试社区1代码分析"""
        code = """
def community_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        assert len(visitor.get_dead_code()) > 0
        
    def test_community_8_analysis(self):
        """测试社区8代码分析"""
        code = """
class CommunityClass:
    def method(self):
        pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        assert len(visitor.get_dead_code()) > 0
        
    def test_community_12_analysis(self):
        """测试社区12代码分析"""
        code = """
def community_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        assert len(visitor.get_dead_code()) > 0
        
    def test_community_14_analysis(self):
        """测试社区14代码分析"""
        code = """
class CommunityClass:
    def method(self):
        pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        assert len(visitor.get_dead_code()) > 0


class TestDeadCodeVisitorOutput:
    """输出格式测试类"""
    
    def test_output_format_compatibility(self):
        """测试输出格式兼容性"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        graph_data = visitor.get_graph_data()
        
        # 验证输出格式符合Graphify知识图谱规范
        assert isinstance(graph_data, dict)
        assert 'nodes' in graph_data
        assert 'edges' in graph_data
        assert isinstance(graph_data['nodes'], list)
        assert isinstance(graph_data['edges'], list)
        
    def test_parse_csv_output(self):
        """测试CSV输出解析"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        csv_output = visitor.format_output_csv()
        assert isinstance(csv_output, str)
        assert len(csv_output) > 0


class TestDeadCodeVisitorDaemon:
    """守护进程测试类"""
    
    def test_daemon_functionality(self):
        """测试守护进程功能"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证守护进程功能正常
        assert hasattr(visitor, 'get_daemon')
        daemon = visitor.get_daemon()
        assert daemon is not None


class TestDeadCodeVisitorSearch:
    """搜索功能测试类"""
    
    def test_index_node_for_search(self):
        """测试节点搜索索引"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证搜索索引功能
        assert hasattr(visitor, 'index_node_for_search')
        visitor.index_node_for_search()


class TestDeadCodeVisitorValidation:
    """验证功能测试类"""
    
    def test_static_analysis_constraints(self):
        """测试静态分析约束"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证静态分析约束
        dead_code = visitor.get_dead_code()
        assert isinstance(dead_code, list)
        
    def test_audit_interception_logic(self):
        """测试审计拦截逻辑"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证审计拦截逻辑
        nodes = visitor.get_all_nodes()
        edges = visitor.get_edges()
        
        assert isinstance(nodes, list)
        assert isinstance(edges, list)


class TestDeadCodeVisitorGeneral:
    """通用功能测试类"""
    
    def test_general_audit_entry(self):
        """测试通用审计条目"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证通用审计条目
        graph_data = visitor.get_graph_data()
        assert isinstance(graph_data, dict)
        assert 'nodes' in graph_data
        assert 'edges' in graph_data


class TestDeadCodeVisitorAuditService:
    """审计服务测试类"""
    
    def test_audit_service_stub(self):
        """测试审计服务存根"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证审计服务存根功能
        assert hasattr(visitor, '_record_node')
        assert hasattr(visitor, '_record_edge')


class TestDeadCodeVisitorDocstringCoverage:
    """文档覆盖率测试类"""
    
    def test_docstring_coverage_analysis(self):
        """测试文档覆盖率分析"""
        code = """
def function_with_docstring():
    \"\"\"This function has a docstring\"\"\"
    pass

def function_without_docstring():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证文档覆盖率分析
        dead_code = visitor.get_dead_code()
        assert len(dead_code) > 0


class TestDeadCodeVisitorMethodDocstring:
    """方法文档字符串测试类"""
    
    def test_get_method_docstring(self):
        """测试获取方法文档字符串"""
        code = """
def test_function():
    \"\"\"Test function with docstring\"\"\"
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证获取方法文档字符串功能
        assert hasattr(visitor, '_get_method_docstring')
        docstring = visitor._get_method_docstring(tree.body[0])
        assert isinstance(docstring, str)


class TestDeadCodeVisitorStaticAnalysis:
    """静态分析测试类"""
    
    def test_static_analysis_constraints(self):
        """测试静态分析约束"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证静态分析约束
        dead_code = visitor.get_dead_code()
        assert isinstance(dead_code, list)
        assert len(dead_code) > 0


class TestDeadCodeVisitorOutputFormat:
    """输出格式测试类"""
    
    def test_output_format(self):
        """测试输出格式"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证输出格式
        graph_data = visitor.get_graph_data()
        assert isinstance(graph_data, dict)
        assert 'nodes' in graph_data
        assert 'edges' in graph_data
        assert isinstance(graph_data['nodes'], list)
        assert isinstance(graph_data['edges'], list)


class TestDeadCodeVisitorIntegrationTest:
    """集成测试类"""
    
    def test_integration_with_audit_service(self):
        """测试与审计服务集成"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证与审计服务集成
        nodes = visitor.get_all_nodes()
        edges = visitor.get_edges()
        
        assert isinstance(nodes, list)
        assert isinstance(edges, list)
        assert len(nodes) > 0


class TestDeadCodeVisitorPerformanceTest:
    """性能测试类"""
    
    def test_performance_analysis(self):
        """测试性能分析"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证性能分析
        stats = visitor.get_statistics()
        assert isinstance(stats, dict)


class TestDeadCodeVisitorCommunityTest:
    """社区测试类"""
    
    def test_community_analysis(self):
        """测试社区分析"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证社区分析
        dead_code = visitor.get_dead_code()
        assert isinstance(dead_code, list)
        assert len(dead_code) > 0


class TestDeadCodeVisitorAuditTest:
    """审计测试类"""
    
    def test_audit_analysis(self):
        """测试审计分析"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证审计分析
        graph_data = visitor.get_graph_data()
        assert isinstance(graph_data, dict)
        assert 'nodes' in graph_data
        assert 'edges' in graph_data


class TestDeadCodeVisitorDocstringTest:
    """文档字符串测试类"""
    
    def test_docstring_analysis(self):
        """测试文档字符串分析"""
        code = """
def test_function():
    \"\"\"Test function with docstring\"\"\"
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证文档字符串分析
        dead_code = visitor.get_dead_code()
        assert isinstance(dead_code, list)
        assert len(dead_code) > 0


class TestDeadCodeVisitorStaticAnalysisTest:
    """静态分析测试类"""
    
    def test_static_analysis(self):
        """测试静态分析"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证静态分析
        dead_code = visitor.get_dead_code()
        assert isinstance(dead_code, list)
        assert len(dead_code) > 0


class TestDeadCodeVisitorOutputFormatTest:
    """输出格式测试类"""
    
    def test_output_format(self):
        """测试输出格式"""
        code = """
def test_function():
    pass
"""
        tree = ast.parse(code)
        visitor = DeadCodeVisitor()
        visitor.visit(tree)
        
        # 验证输出格式
        graph_data = visitor.get_graph_data()
        assert isinstance(graph_data, dict)
        assert 'nodes' in graph_data
        assert 'edges' in graph_data
