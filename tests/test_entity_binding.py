"""
Tests for entity binding functionality in SWARM-002 quality deep audit.
This module contains comprehensive test cases for entity binding operations
across mutation rounds 31-49, focusing on data integrity and performance.
"""

import pytest
import timeit
import tracemalloc
from typing import List, Dict, Any, Optional
from unittest.mock import Mock, patch, MagicMock
import json
import os
import sys

# Add the src directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from hooks.useAuditLog import (
    convertAuditLogsToGraphifyNodes,
    validateGraphifyNodes,
    validateGraphifyNodesDetailed,
    GraphifyNode,
    AuditLogEntry
)
from components.flow.CustomNodes import getGraphifyNodes
from tests.unit.memory.index import (
    generateGraphifyNodesMock,
    validateGraphifyNodesMock
)


class TestEntityBinding:
    """Test suite for entity binding functionality."""
    
    def setup_method(self):
        """Set up test fixtures before each test method."""
        self.sample_audit_logs = [
            {
                'id': 'log-001',
                'assetId': 'asset-123',
                'changes': {
                    'field1': {'old': 'value1', 'new': 'value2'},
                    'field2': {'old': 'old_value', 'new': 'new_value'}
                },
                'timestamp': '2023-01-01T00:00:00Z'
            },
            {
                'id': 'log-002',
                'assetId': 'asset-123',
                'changes': {
                    'field3': {'old': 'old', 'new': 'new'}
                },
                'timestamp': '2023-01-02T00:00:00Z'
            }
        ]
        
        self.asset_id = 'asset-123'
        self.expected_nodes_count = 3  # asset node + 2 change nodes
        
    def test_convert_audit_logs_to_graphify_nodes_basic(self):
        """Test basic conversion of audit logs to graphify nodes."""
        # ATB-BC-001, ATB-BC-002: Test empty input handling
        assert convertAuditLogsToGraphifyNodes([], self.asset_id) == []
        assert convertAuditLogsToGraphifyNodes(None, self.asset_id) == []
        
        # ATB-EX-001: Test invalid assetId handling
        assert convertAuditLogsToGraphifyNodes(self.sample_audit_logs, '') == []
        assert convertAuditLogsToGraphifyNodes(self.sample_audit_logs, None) == []
        
        # Normal case test
        nodes = convertAuditLogsToGraphifyNodes(
            self.sample_audit_logs,
            self.asset_id,
            {'includeRootNode': True}
        )
        
        # Verify node count
        assert len(nodes) == self.expected_nodes_count
        
        # Verify asset node exists
        asset_node = next((n for n in nodes if n['type'] == 'asset'), None)
        assert asset_node is not None
        assert asset_node['id'] == f'asset-{self.asset_id}'
        
        # Verify change nodes exist
        change_nodes = [n for n in nodes if n['type'] == 'change']
        assert len(change_nodes) == 2
        
    def test_convert_audit_logs_to_graphify_nodes_performance(self):
        """Test performance of audit log conversion."""
        # Generate large dataset for performance testing
        large_dataset = [
            {
                'id': f'log-{i:03d}',
                'assetId': self.asset_id,
                'changes': {
                    f'field_{j}': {'old': f'old_{j}', 'new': f'new_{j}'}
                },
                'timestamp': '2023-01-01T00:00:00Z'
            }
            for i in range(100)
            for j in range(5)
        ]
        
        # ATB-PERF-001: Performance benchmark
        time_taken = timeit.timeit(
            lambda: convertAuditLogsToGraphifyNodes(large_dataset, self.asset_id),
            number=10
        )
        
        # Assert execution time is within acceptable range (adjust threshold as needed)
        assert time_taken < 1.0, f"Performance test failed: {time_taken}s > 1.0s"
        
    def test_convert_audit_logs_to_graphify_nodes_memory_usage(self):
        """Test memory usage of audit log conversion."""
        tracemalloc.start()
        
        # Generate large dataset
        large_dataset = [
            {
                'id': f'log-{i:03d}',
                'assetId': self.asset_id,
                'changes': {
                    f'field_{j}': {'old': f'old_{j}', 'new': f'new_{j}'}
                },
                'timestamp': '2023-01-01T00:00:00Z'
            }
            for i in range(100)
            for j in range(5)
        ]
        
        # Take initial memory snapshot
        snapshot1 = tracemalloc.take_snapshot()
        
        # Execute conversion
        nodes = convertAuditLogsToGraphifyNodes(large_dataset, self.asset_id)
        
        # Take final memory snapshot
        snapshot2 = tracemalloc.take_snapshot()
        
        # Calculate memory difference
        top_stats = snapshot2.compare_to(snapshot1, 'lineno')
        total_diff = sum(stat.size_diff for stat in top_stats)
        
        # ATB-MEM-001: Memory growth constraint
        initial_memory = snapshot1.size
        memory_growth_percent = (total_diff / initial_memory) * 100 if initial_memory > 0 else 0
        assert memory_growth_percent < 5, f"Memory growth {memory_growth_percent}% exceeds 5% limit"
        
        tracemalloc.stop()
        
    def test_validate_graphify_nodes_basic(self):
        """Test basic node validation."""
        # ATB-BC-003, ATB-BC-001: Test empty and None inputs
        assert validateGraphifyNodes([]) == True
        assert validateGraphifyNodes(None) == False
        assert validateGraphifyNodes('not an array') == False
        
        # Test valid nodes
        valid_nodes = [
            {'id': 'node1', 'label': 'Node 1', 'type': 'asset'},
            {'id': 'node2', 'label': 'Node 2', 'type': 'change'}
        ]
        assert validateGraphifyNodes(valid_nodes) == True
        
        # Test invalid nodes
        invalid_nodes = [
            {'id': 'node1', 'label': 'Node 1', 'type': 'asset'},
            None,  # Invalid node
            {'id': 'node3', 'label': 'Node 3'}  # Missing type
        ]
        assert validateGraphifyNodes(invalid_nodes) == False
        
    def test_validate_graphify_nodes_detailed(self):
        """Test detailed node validation."""
        # Test empty array
        result = validateGraphifyNodesDetailed([])
        assert result['isValid'] == True
        assert result['invalidIndices'] == []
        assert result['errors'] == []
        
        # Test None input
        result = validateGraphifyNodesDetailed(None)
        assert result['isValid'] == False
        assert 'Input is not an array' in result['errors']
        
        # Test mixed valid/invalid nodes
        mixed_nodes = [
            {'id': 'node1', 'label': 'Node 1', 'type': 'asset'},
            None,
            {'id': 'node3', 'label': 'Node 3'}  # Missing type
        ]
        result = validateGraphifyNodesDetailed(mixed_nodes)
        
        assert result['isValid'] == False
        assert 1 in result['invalidIndices']  # None at index 1
        assert 2 in result['invalidIndices']  # Missing type at index 2
        assert len(result['errors']) == 2
        
    def test_get_graphify_nodes_integration(self):
        """Test integration with getGraphifyNodes function."""
        # Mock graphify nodes data
        mock_graphify_nodes = [
            {
                'id': 'asset-123',
                'type': 'asset',
                'label': 'Test Asset',
                'properties': {'assetId': 'asset-123'}
            },
            {
                'id': 'change-001',
                'type': 'change',
                'label': 'Field Change',
                'properties': {'field': 'field1'}
            }
        ]
        
        # Test asset node filtering
        asset_nodes = getGraphifyNodes(
            mock_graphify_nodes,
            'asset',
            {'assetId': 'asset-123'}
        )
        assert len(asset_nodes) == 1
        assert asset_nodes[0]['id'] == 'asset-123'
        
        # Test change node filtering
        change_nodes = getGraphifyNodes(
            mock_graphify_nodes,
            'change'
        )
        assert len(change_nodes) == 1
        assert change_nodes[0]['id'] == 'change-001'
        
    def test_mock_functions_memory_safety(self):
        """Test mock functions for memory safety with large datasets."""
        # Generate large mock dataset
        large_audit_logs = [
            {
                'id': f'log-{i:03d}',
                'assetId': self.asset_id,
                'changes': {
                    f'field_{j}': {'old': f'old_{j}', 'new': f'new_{j}'}
                },
                'timestamp': '2023-01-01T00:00:00Z'
            }
            for i in range(1000)
            for j in range(10)
        ]
        
        # ATB-ML-001: Test cycle reference detection
        nodes = generateGraphifyNodesMock(large_audit_logs, self.asset_id)
        assert len(nodes) > 0
        
        # ATB-ML-002: Test large array traversal
        is_valid = validateGraphifyNodesMock(nodes)
        assert is_valid == True
        
    def test_edge_cases_and_error_handling(self):
        """Test edge cases and error handling scenarios."""
        # Test with malformed audit logs
        malformed_logs = [
            {'id': 'log-001', 'assetId': self.asset_id, 'changes': None},
            {'id': 'log-002', 'assetId': self.asset_id, 'changes': 'invalid'}
        ]
        
        # Should handle gracefully without crashing
        nodes = convertAuditLogsToGraphifyNodes(malformed_logs, self.asset_id)
        assert isinstance(nodes, list)
        
        # Test with special characters in IDs
        special_id = 'asset-@#$%^&*()'
        special_logs = [{
            'id': 'log-001',
            'assetId': special_id,
            'changes': {'field': {'old': 'old', 'new': 'new'}}
        }]
        
        nodes = convertAuditLogsToGraphifyNodes(special_logs, special_id)
        assert len(nodes) > 0
        
    def test_static_analysis_compliance(self):
        """Test compliance with static analysis requirements."""
        # All test functions should have proper docstrings
        assert convertAuditLogsToGraphifyNodes.__doc__ is not None
        assert validateGraphifyNodes.__doc__ is not None
        assert validateGraphifyNodesDetailed.__doc__ is not None
        assert getGraphifyNodes.__doc__ is not None
        
        # Test functions should follow naming conventions
        assert self.test_convert_audit_logs_to_graphify_nodes_basic.__name__.startswith('test_')
        assert self.test_validate_graphify_nodes_basic.__name__.startswith('test_')
        
    def test_import_integrity(self):
        """Test import integrity and module dependencies."""
        # Test that all required modules can be imported
        try:
            from hooks.useAuditLog import GraphifyNode, AuditLogEntry
            from components.flow.CustomNodes import getGraphifyNodes
            from tests.unit.memory.index import generateGraphifyNodesMock, validateGraphifyNodesMock
        except ImportError as e:
            pytest.fail(f"Import failed: {e}")
            
        # Test that functions are callable
        assert callable(convertAuditLogsToGraphifyNodes)
        assert callable(validateGraphifyNodes)
        assert callable(validateGraphifyNodesDetailed)
        assert callable(getGraphifyNodes)
        assert callable(generateGraphifyNodesMock)
        assert callable(validateGraphifyNodesMock)


class TestEntityBindingPerformance:
    """Performance-focused test suite for entity binding."""
    
    @pytest.mark.performance
    def test_large_dataset_processing(self):
        """Test processing of large datasets."""
        # Generate dataset with 10,000 audit logs
        large_dataset = [
            {
                'id': f'log-{i:05d}',
                'assetId': 'asset-123',
                'changes': {
                    f'field_{j}': {'old': f'old_{j}', 'new': f'new_{j}'}
                },
                'timestamp': '2023-01-01T00:00:00Z'
            }
            for i in range(10000)
            for j in range(3)
        ]
        
        # Performance benchmark
        execution_time = timeit.timeit(
            lambda: convertAuditLogsToGraphifyNodes(large_dataset, 'asset-123'),
            number=5
        )
        
        # Assert performance meets requirements
        assert execution_time < 5.0, f"Large dataset processing too slow: {execution_time}s"
        
    @pytest.mark.memory
    def test_memory_usage_scaling(self):
        """Test memory usage scales appropriately with dataset size."""
        tracemalloc.start()
        
        # Test with different dataset sizes
        sizes = [100, 1000, 5000]
        memory_usage = {}
        
        for size in sizes:
            dataset = [
                {
                    'id': f'log-{i:05d}',
                    'assetId': 'asset-123',
                    'changes': {'field': {'old': 'old', 'new': 'new'}},
                    'timestamp': '2023-01-01T00:00:00Z'
                }
                for i in range(size)
            ]
            
            snapshot1 = tracemalloc.take_snapshot()
            nodes = convertAuditLogsToGraphifyNodes(dataset, 'asset-123')
            snapshot2 = tracemalloc.take_snapshot()
            
            top_stats = snapshot2.compare_to(snapshot1, 'lineno')
            total_diff = sum(stat.size_diff for stat in top_stats)
            
            memory_usage[size] = total_diff
            
            # Assert memory growth is linear
            if size > 100:
                growth_ratio = memory_usage[size] / memory_usage[size//10]
                assert growth_ratio < 10, f"Memory growth non-linear: {growth_ratio}"
        
        tracemalloc.stop()


class TestEntityBindingQuality:
    """Quality-focused test suite for entity binding."""
    
    def test_data_integrity(self):
        """Test data integrity throughout conversion process."""
        original_logs = [
            {
                'id': 'log-001',
                'assetId': 'asset-123',
                'changes': {
                    'field1': {'old': 'old_value', 'new': 'new_value'},
                    'field2': {'old': 'old', 'new': 'new'}
                },
                'timestamp': '2023-01-01T00:00:00Z'
            }
        ]
        
        nodes = convertAuditLogsToGraphifyNodes(original_logs, 'asset-123')
        
        # Verify all original data is preserved
        assert len(nodes) == 3  # asset + 2 change nodes
        
        # Verify asset node integrity
        asset_node = next(n for n in nodes if n['type'] == 'asset')
        assert asset_node['id'] == 'asset-asset-123'
        assert asset_node['properties']['assetId'] == 'asset-123'
        
        # Verify change nodes integrity
        change_nodes = [n for n in nodes if n['type'] == 'change']
        assert len(change_nodes) == 2
        
        # Verify no data loss or corruption
        for node in change_nodes:
            assert 'id' in node
            assert 'label' in node
            assert 'properties' in node
            assert isinstance(node['properties'], dict)
            
    def test_error_handling_robustness(self):
        """Test robustness of error handling mechanisms."""
        # Test with various invalid inputs
        invalid_inputs = [
            None,
            [],
            [None],
            [{'id': 123, 'label': 'invalid'}],  # Invalid ID type
            [{'id': 'valid', 'label': 'valid', 'type': 123}],  # Invalid type
            [{'id': '', 'label': 'empty id'}],  # Empty ID
        ]
        
        for invalid_input in invalid_inputs:
            try:
                result = convertAuditLogsToGraphifyNodes(invalid_input, 'asset-123')
                # Should either return empty list or handle gracefully
                assert isinstance(result, list)
            except Exception as e:
                pytest.fail(f"Error handling failed for input {invalid_input}: {e}")
                
    def test_concurrent_processing_safety(self):
        """Test safety of concurrent processing."""
        import threading
        
        def process_chunk(chunk):
            return convertAuditLogsToGraphifyNodes(chunk, 'asset-123')
        
        # Create multiple chunks for concurrent processing
        chunk_size = 100
        all_logs = [
            {
                'id': f'log-{i:05d}',
                'assetId': 'asset-123',
                'changes': {'field': {'old': 'old', 'new': 'new'}},
                'timestamp': '2023-01-01T00:00:00Z'
            }
            for i in range(1000)
        ]
        
        chunks = [
            all_logs[i:i + chunk_size] 
            for i in range(0, len(all_logs), chunk_size)
        ]
        
        # Process chunks concurrently
        threads = []
        results = []
        
        for chunk in chunks:
            thread = threading.Thread(target=lambda c=chunk: results.append(process_chunk(c)))
            threads.append(thread)
            thread.start()
            
        for thread in threads:
            thread.join()
            
        # Verify all results are valid
        for result in results:
            assert isinstance(result, list)
            for node in result:
                assert isinstance(node, dict)
                assert 'id' in node
                assert 'label' in node


if __name__ == '__main__':
    # Run tests with coverage
    pytest.main([
        '--cov=hooks/useAuditLog',
        '--cov=components/flow/CustomNodes',
        '--cov=tests/unit/memory/index',
        '--cov-report=xml',
        '--cov-report=html',
        'tests/test_entity_binding.py'
    ])