#!/usr/bin/env python3
"""
Test suite for deprecated cleanup functionality.
This module contains comprehensive tests for the DeadCodeVisitor class and related functionality.
"""

import ast
import csv
import io
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch, call

# Add the scripts directory to the path to import the DeadCodeVisitor
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts'))

from ast_dead_code_check import DeadCodeVisitor


class TestBasicStructureValidation(unittest.TestCase):
    """Test basic structure validation of DeadCodeVisitor."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.sample_code = '''
class TestClass:
    """A test class."""
    
    def __init__(self):
        """Initialize the test class."""
        self.value = 42
    
    def active_method(self):
        """An active method."""
        return self.value
    
    def unused_method(self):
        """An unused method."""
        return 0
'''
        self.visitor = DeadCodeVisitor()
    
    def test_visitor_initialization(self):
        """Test that DeadCodeVisitor initializes correctly."""
        self.assertIsNotNone(self.visitor)
        self.assertEqual(self.visitor.dead_code_count, 0)
        self.assertEqual(len(self.visitor.dead_code_nodes), 0)
        self.assertEqual(len(self.visitor.all_nodes), 0)
        self.assertEqual(len(self.visitor.edges), 0)
    
    def test_ast_parsing(self):
        """Test that AST parsing works correctly."""
        tree = ast.parse(self.sample_code)
        self.assertIsNotNone(tree)
        self.assertIsInstance(tree, ast.Module)
    
    def test_node_counting(self):
        """Test that nodes are counted correctly."""
        tree = ast.parse(self.sample_code)
        self.visitor.visit(tree)
        
        # Should have class, methods, and other nodes
        self.assertGreater(len(self.visitor.all_nodes), 0)
        self.assertGreater(len(self.visitor.dead_code_nodes), 0)


class TestStaticAnalysisConstraints(unittest.TestCase):
    """Test static analysis constraints and validation."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.visitor = DeadCodeVisitor()
    
    def test_empty_function_detection(self):
        """Test detection of empty functions."""
        empty_code = '''
def empty_function():
    pass

def non_empty_function():
    return 42
'''
        tree = ast.parse(empty_code)
        self.visitor.visit(tree)
        
        # Should detect empty functions
        empty_functions = [node for node in self.visitor.dead_code_nodes 
                          if hasattr(node, 'name') and node.name == 'empty_function']
        self.assertEqual(len(empty_functions), 1)
    
    def test_empty_class_detection(self):
        """Test detection of empty classes."""
        empty_class_code = '''
class EmptyClass:
    pass

class NonEmptyClass:
    def method(self):
        return 42
'''
        tree = ast.parse(empty_class_code)
        self.visitor.visit(tree)
        
        # Should detect empty classes
        empty_classes = [node for node in self.visitor.dead_code_nodes 
                        if hasattr(node, 'name') and node.name == 'EmptyClass']
        self.assertEqual(len(empty_classes), 1)
    
    def test_dead_code_candidate_analysis(self):
        """Test dead code candidate analysis."""
        code_with_unused = '''
def used_function():
    return "used"

def unused_function():
    return "unused"

used_function()  # This function is used
'''
        tree = ast.parse(code_with_unused)
        self.visitor.visit(tree)
        
        # Should identify unused functions
        unused_functions = [node for node in self.visitor.dead_code_nodes 
                           if hasattr(node, 'name') and node.name == 'unused_function']
        self.assertEqual(len(unused_functions), 1)


class TestAuditInterceptionLogic(unittest.TestCase):
    """Test audit service integration and interception logic."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.visitor = DeadCodeVisitor()
        self.mock_audit_service = MagicMock()
        
    def test_node_recording(self):
        """Test that nodes are recorded correctly in audit service."""
        code = '''
def test_function():
    return "test"
'''
        tree = ast.parse(code)
        
        with patch('ast_dead_code_check.AuditService', self.mock_audit_service):
            self.visitor.visit(tree)
            
            # Verify that nodes are recorded
            self.mock_audit_service.record_node.assert_called()
    
    def test_edge_recording(self):
        """Test that edges are recorded correctly in audit service."""
        code = '''
class TestClass:
    def method(self):
        return "test"
'''
        tree = ast.parse(code)
        
        with patch('ast_dead_code_check.AuditService', self.mock_audit_service):
            self.visitor.visit(tree)
            
            # Verify that edges are recorded
            self.mock_audit_service.record_edge.assert_called()
    
    def test_audit_service_integration(self):
        """Test complete audit service integration."""
        code = '''
def active_function():
    return "active"

def unused_function():
    return "unused"
'''
        tree = ast.parse(code)
        
        with patch('ast_dead_code_check.AuditService', self.mock_audit_service):
            self.visitor.visit(tree)
            
            # Verify audit service calls
            self.assertTrue(self.mock_audit_service.record_node.called)
            self.assertTrue(self.mock_audit_service.record_edge.called)


class TestOutputFormat(unittest.TestCase):
    """Test output format compliance with Graphify knowledge图谱规范."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.visitor = DeadCodeVisitor()
    
    def test_format_output_csv(self):
        """Test CSV output format."""
        code = '''
def test_function():
    return "test"
'''
        tree = ast.parse(code)
        self.visitor.visit(tree)
        
        # Test CSV formatting
        csv_output = self.visitor.format_output_csv()
        self.assertIsInstance(csv_output, str)
        self.assertIn('node_id', csv_output)
        self.assertIn('node_type', csv_output)
    
    def test_parse_csv_output(self):
        """Test CSV output parsing."""
        csv_data = '''node_id,node_type,name,community
1,function,test_function,1
2,class,TestClass,1'''
        
        parsed_data = self.visitor.parse_csv_output(csv_data)
        self.assertIsInstance(parsed_data, list)
        self.assertEqual(len(parsed_data), 2)
        self.assertEqual(parsed_data[0]['node_id'], '1')
        self.assertEqual(parsed_data[0]['node_type'], 'function')
    
    def test_graph_data_structure(self):
        """Test graph data structure compliance."""
        code = '''
def test_function():
    return "test"
'''
        tree = ast.parse(code)
        self.visitor.visit(tree)
        
        graph_data = self.visitor.get_graph_data()
        self.assertIsInstance(graph_data, dict)
        self.assertIn('nodes', graph_data)
        self.assertIn('edges', graph_data)
        self.assertIsInstance(graph_data['nodes'], list)
        self.assertIsInstance(graph_data['edges'], list)
    
    def test_get_all_nodes(self):
        """Test get_all_nodes method."""
        code = '''
def test_function():
    return "test"
'''
        tree = ast.parse(code)
        self.visitor.visit(tree)
        
        all_nodes = self.visitor.get_all_nodes()
        self.assertIsInstance(all_nodes, list)
        self.assertGreater(len(all_nodes), 0)
    
    def test_get_edges(self):
        """Test get_edges method."""
        code = '''
class TestClass:
    def method(self):
        return "test"
'''
        tree = ast.parse(code)
        self.visitor.visit(tree)
        
        edges = self.visitor.get_edges()
        self.assertIsInstance(edges, list)
        # Should have edges between class and method
        self.assertGreater(len(edges), 0)
    
    def test_statistics_output(self):
        """Test statistics output format."""
        code = '''
def active_function():
    return "active"

def unused_function():
    return "unused"
'''
        tree = ast.parse(code)
        self.visitor.visit(tree)
        
        stats = self.visitor.get_statistics()
        self.assertIsInstance(stats, dict)
        self.assertIn('dead_code_count', stats)
        self.assertIn('total_nodes', stats)
        self.assertIn('total_edges', stats)


class TestGeneralAuditEntry(unittest.TestCase):
    """Test GeneralAuditEntry functionality."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.visitor = DeadCodeVisitor()
    
    def test_audit_entry_creation(self):
        """Test creation of audit entries."""
        code = '''
def test_function():
    return "test"
'''
        tree = ast.parse(code)
        self.visitor.visit(tree)
        
        # Verify that audit entries are created
        self.assertGreater(len(self.visitor.all_nodes), 0)
        
        # Check that nodes have proper audit information
        for node in self.visitor.all_nodes:
            self.assertIn('node_id', node)
            self.assertIn('node_type', node)
            self.assertIn('community', node)


class TestAuditServiceStub(unittest.TestCase):
    """Test AuditServiceStub functionality."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.visitor = DeadCodeVisitor()
    
    def test_audit_service_stub_initialization(self):
        """Test that AuditServiceStub initializes correctly."""
        # This test verifies that the audit service stub works
        # without actual external dependencies
        code = '''
def test_function():
    return "test"
'''
        tree = ast.parse(code)
        
        # Should not raise any exceptions
        try:
            self.visitor.visit(tree)
            self.assertTrue(True)  # If we reach here, no exception was raised
        except Exception as e:
            self.fail(f"AuditServiceStub initialization failed: {e}")
    
    def test_mock_audit_service_compatibility(self):
        """Test compatibility with mock audit service."""
        code = '''
def test_function():
    return "test"
'''
        tree = ast.parse(code)
        
        with patch('ast_dead_code_check.AuditService') as mock_audit:
            mock_audit.return_value = MagicMock()
            self.visitor.visit(tree)
            
            # Verify that the mock was called
            mock_audit.assert_called_once()


if __name__ == '__main__':
    unittest.main()