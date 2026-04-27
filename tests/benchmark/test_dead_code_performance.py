#!/usr/bin/env python3
"""
Dead Code Performance Benchmark Tests

This module contains performance benchmarks for the DeadCodeVisitor functionality,
designed to validate the performance characteristics of dead code detection
across different community modules (1, 8, 12, 14).

Based on Sprint 5 requirements for technical debt analysis and Graphify integration.
"""

import pytest
import time
import tempfile
import os
from pathlib import Path
from typing import Dict, List, Any

# Import the DeadCodeVisitor from the main analysis script
from scripts.ast_dead_code_check import DeadCodeVisitor


class TestDeadCodePerformance:
    """Performance benchmark tests for DeadCodeVisitor functionality."""
    
    @pytest.fixture
    def sample_files(self) -> Dict[str, str]:
        """Create sample Python files for testing performance."""
        samples = {
            'simple_module': '''
def active_function():
    """Active function with proper docstring."""
    return "active"

def dead_function():
    """Dead function that should be detected."""
    return "dead"

class ActiveClass:
    """Active class with proper docstring."""
    def active_method(self):
        return "active"
    
    def dead_method(self):
        """Dead method that should be detected."""
        return "dead"
''',
            'complex_module': '''
import os
import sys

def main():
    """Main entry point."""
    active_function()
    return True

def active_function():
    """Active function with complex logic."""
    data = []
    for i in range(1000):
        data.append(i)
    return sum(data)

def unused_function():
    """Unused function that should be detected."""
    result = []
    for i in range(500):
        result.append(i * 2)
    return result

class ActiveService:
    """Active service class."""
    def __init__(self):
        self.data = []
    
    def process_data(self):
        """Active method."""
        return len(self.data)
    
    def unused_method(self):
        """Unused method that should be detected."""
        return "unused"

class UnusedClass:
    """Unused class that should be detected."""
    def __init__(self):
        self.value = 42
    
    def get_value(self):
        return self.value
''',
            'large_module': '''
"""Large module with mixed active and dead code."""

def active_function_1():
    """Active function 1."""
    return "active1"

def active_function_2():
    """Active function 2."""
    return "active2"

# Large block of dead code
def dead_function_1():
    """Dead function 1."""
    pass

def dead_function_2():
    """Dead function 2."""
    pass

def dead_function_3():
    """Dead function 3."""
    pass

def dead_function_4():
    """Dead function 4."""
    pass

def dead_function_5():
    """Dead function 5."""
    pass

class ActiveClass:
    """Active class."""
    def active_method(self):
        return "active"

class DeadClass:
    """Dead class."""
    def dead_method(self):
        return "dead"
'''
        }
        return samples
    
    @pytest.fixture
    def temp_files(self, sample_files: Dict[str, str]) -> List[str]:
        """Create temporary files for testing."""
        temp_files = []
        temp_dir = tempfile.mkdtemp()
        
        for filename, content in sample_files.items():
            file_path = os.path.join(temp_dir, f"{filename}.py")
            with open(file_path, 'w') as f:
                f.write(content)
            temp_files.append(file_path)
        
        yield temp_files
        
        # Cleanup
        for file_path in temp_files:
            if os.path.exists(file_path):
                os.remove(file_path)
        os.rmdir(temp_dir)
    
    def test_dead_code_detection_performance(self, temp_files: List[str]):
        """Test performance of dead code detection across multiple files."""
        visitor = DeadCodeVisitor()
        
        start_time = time.time()
        results = []
        
        for file_path in temp_files:
            try:
                result = visitor.analyze_with_ast(file_path)
                results.append(result)
            except Exception as e:
                pytest.fail(f"Failed to analyze {file_path}: {e}")
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Performance assertions
        assert processing_time < 5.0, f"Processing took too long: {processing_time:.2f}s"
        
        # Validate results structure
        for result in results:
            assert 'nodes' in result, "Result should contain nodes"
            assert 'edges' in result, "Result should contain edges"
            assert 'statistics' in result, "Result should contain statistics"
        
        # Check that dead code was detected
        total_dead_code = sum(len(result['statistics']['dead_code_candidates']) for result in results)
        assert total_dead_code > 0, "Should detect some dead code"
    
    def test_memory_usage_performance(self, temp_files: List[str]):
        """Test memory usage performance during dead code analysis."""
        import psutil
        import gc
        
        visitor = DeadCodeVisitor()
        process = psutil.Process()
        
        # Get initial memory usage
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Perform analysis
        results = []
        for file_path in temp_files:
            result = visitor.analyze_with_ast(file_path)
            results.append(result)
        
        # Force garbage collection
        gc.collect()
        
        # Get final memory usage
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Memory usage should be reasonable
        assert memory_increase < 100, f"Memory usage increased too much: {memory_increase:.2f}MB"
    
    def test_large_file_performance(self):
        """Test performance with a large Python file."""
        # Create a large file with many dead code candidates
        large_content = '''
"""Large file for performance testing."""

def active_function():
    """Active function."""
    return "active"

''' + '\n'.join([f'def dead_function_{i}():\n    """Dead function {i}."""\n    pass' for i in range(1000)])
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(large_content)
            temp_file = f.name
        
        try:
            visitor = DeadCodeVisitor()
            start_time = time.time()
            
            result = visitor.analyze_with_ast(temp_file)
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Performance assertion for large file
            assert processing_time < 10.0, f"Large file processing took too long: {processing_time:.2f}s"
            
            # Validate results
            assert len(result['nodes']) > 0, "Should detect nodes in large file"
            assert 'statistics' in result, "Should contain statistics"
            
        finally:
            os.unlink(temp_file)
    
    def test_concurrent_analysis_performance(self, temp_files: List[str]):
        """Test performance of concurrent dead code analysis."""
        import threading
        
        def analyze_file(file_path):
            visitor = DeadCodeVisitor()
            return visitor.analyze_with_ast(file_path)
        
        # Start concurrent analysis
        start_time = time.time()
        threads = []
        results = []
        
        for file_path in temp_files:
            thread = threading.Thread(target=lambda fp=file_path: results.append(analyze_file(fp)))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Concurrent performance should be reasonable
        assert processing_time < 3.0, f"Concurrent processing took too long: {processing_time:.2f}s"
        
        # Validate all results
        for result in results:
            assert 'nodes' in result, "Result should contain nodes"
            assert 'edges' in result, "Result should contain edges"
    
    def test_graph_output_performance(self, temp_files: List[str]):
        """Test performance of graph output generation."""
        visitor = DeadCodeVisitor()
        
        # Analyze files first
        analysis_results = []
        for file_path in temp_files:
            result = visitor.analyze_with_ast(file_path)
            analysis_results.append(result)
        
        # Test graph data generation performance
        start_time = time.time()
        
        for result in analysis_results:
            # Test various graph output methods
            graph_data = visitor.get_graph_data()
            nodes = visitor.get_all_nodes()
            edges = visitor.get_edges()
            statistics = visitor.get_statistics()
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Graph output should be fast
        assert processing_time < 2.0, f"Graph output generation took too long: {processing_time:.2f}s"
        
        # Validate output structure
        assert isinstance(graph_data, dict), "Graph data should be a dictionary"
        assert isinstance(nodes, list), "Nodes should be a list"
        assert isinstance(edges, list), "Edges should be a list"
        assert isinstance(statistics, dict), "Statistics should be a dictionary"
    
    def test_csv_output_performance(self, temp_files: List[str]):
        """Test performance of CSV output generation."""
        visitor = DeadCodeVisitor()
        
        # Analyze files first
        for file_path in temp_files:
            visitor.analyze_with_ast(file_path)
        
        # Test CSV output performance
        start_time = time.time()
        
        csv_output = visitor.format_output_csv()
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # CSV output should be fast
        assert processing_time < 1.0, f"CSV output generation took too long: {processing_time:.2f}s"
        
        # Validate CSV output
        assert isinstance(csv_output, str), "CSV output should be a string"
        assert len(csv_output) > 0, "CSV output should not be empty"
    
    def test_community_specific_performance(self, temp_files: List[str]):
        """Test performance with community-specific modules (1, 8, 12, 14)."""
        community_modules = {
            1: temp_files[0],  # simple_module
            8: temp_files[1],  # complex_module  
            12: temp_files[2], # large_module
            14: temp_files[0]  # reuse simple module
        }
        
        visitor = DeadCodeVisitor()
        results = {}
        
        start_time = time.time()
        
        for community_id, file_path in community_modules.items():
            try:
                result = visitor.analyze_with_ast(file_path)
                results[community_id] = result
            except Exception as e:
                pytest.fail(f"Failed to analyze community {community_id} module: {e}")
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Community-specific analysis should be efficient
        assert processing_time < 8.0, f"Community analysis took too long: {processing_time:.2f}s"
        
        # Validate results for each community
        for community_id, result in results.items():
            assert 'nodes' in result, f"Community {community_id} result should contain nodes"
            assert 'edges' in result, f"Community {community_id} result should contain edges"
            assert 'statistics' in result, f"Community {community_id} result should contain statistics"
    
    def test_audit_integration_performance(self, temp_files: List[str]):
        """Test performance with audit service integration."""
        from tests.sprint4.test_deprecated_cleanup import AuditServiceStub
        
        visitor = DeadCodeVisitor()
        audit_service = AuditServiceStub()
        
        # Mock audit service integration
        original_record_node = visitor._record_node
        original_record_edge = visitor._record_edge
        
        def mock_record_node(node_data):
            audit_service.log_audit_event({
                'action': 'NODE_CREATED',
                'entityType': 'node',
                'entityId': node_data.get('id', 'unknown'),
                'timestamp': time.time()
            })
            return original_record_node(node_data)
        
        def mock_record_edge(edge_data):
            audit_service.log_audit_event({
                'action': 'EDGE_CREATED', 
                'entityType': 'edge',
                'entityId': edge_data.get('id', 'unknown'),
                'timestamp': time.time()
            })
            return original_record_edge(edge_data)
        
        # Replace methods with mocked versions
        visitor._record_node = mock_record_node
        visitor._record_edge = mock_record_edge
        
        try:
            start_time = time.time()
            
            for file_path in temp_files:
                visitor.analyze_with_ast(file_path)
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Audit integration should not significantly impact performance
            assert processing_time < 6.0, f"Audit integration took too long: {processing_time:.2f}s"
            
            # Verify audit events were recorded
            assert len(audit_service.get_audit_logs()) > 0, "Should have recorded audit events"
            
        finally:
            # Restore original methods
            visitor._record_node = original_record_node
            visitor._record_edge = original_record_edge


class TestDeadCodePerformanceConstraints:
    """Test performance constraints and edge cases."""
    
    def test_empty_file_performance(self):
        """Test performance with empty Python files."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write('"""Empty file."""\n')
            temp_file = f.name
        
        try:
            visitor = DeadCodeVisitor()
            start_time = time.time()
            
            result = visitor.analyze_with_ast(temp_file)
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Empty file processing should be very fast
            assert processing_time < 0.5, f"Empty file processing took too long: {processing_time:.2f}s"
            
            # Should handle empty files gracefully
            assert 'nodes' in result, "Should handle empty files"
            assert 'edges' in result, "Should handle empty files"
            
        finally:
            os.unlink(temp_file)
    
    def test_syntax_error_file_performance(self):
        """Test performance with files containing syntax errors."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write('def broken_function(\n    """Function with syntax error."""\n    return "broken"\n')
            temp_file = f.name
        
        try:
            visitor = DeadCodeVisitor()
            start_time = time.time()
            
            # Should handle syntax errors gracefully
            with pytest.raises(SyntaxError):
                visitor.analyze_with_ast(temp_file)
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Error handling should be fast
            assert processing_time < 1.0, f"Error handling took too long: {processing_time:.2f}s"
            
        finally:
            os.unlink(temp_file)
    
    def test_recursive_analysis_performance(self):
        """Test performance with recursive analysis (limited depth)."""
        visitor = DeadCodeVisitor()
        
        # Create a file with recursive imports (limited to avoid infinite loops)
        recursive_content = '''
"""File with limited recursive imports."""

import sys
sys.path.append('.')

def active_function():
    """Active function."""
    return "active"

def dead_function():
    """Dead function."""
    return "dead"
'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(recursive_content)
            temp_file = f.name
        
        try:
            start_time = time.time()
            
            result = visitor.analyze_with_ast(temp_file)
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Recursive analysis should be controlled
            assert processing_time < 2.0, f"Recursive analysis took too long: {processing_time:.2f}s"
            
            # Should still produce valid results
            assert 'nodes' in result, "Should handle recursive analysis"
            assert 'edges' in result, "Should handle recursive analysis"
            
        finally:
            os.unlink(temp_file)