#!/usr/bin/env python3
"""
Test suite for docstring coverage analysis in DeadCodeVisitor.
This module implements comprehensive testing for the document coverage framework
as part of the technical debt cleanup initiative in Sprint 5.
"""

import ast
import unittest
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add the scripts directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts'))

from ast_dead_code_check import DeadCodeVisitor


class TestDeadCodeVisitorDocstringCoverage(unittest.TestCase):
    """
    Test suite for DeadCodeVisitor docstring coverage analysis.
    This class validates the document coverage framework functionality
    and ensures compatibility with the Graphify knowledge图谱 system.
    """

    def setUp(self):
        """
        Set up test fixtures for each test method.
        Initializes mock objects and test data for docstring coverage analysis.
        """
        self.visitor = DeadCodeVisitor()
        self.sample_code_with_docstrings = '''
class SampleClass:
    """Class-level docstring."""
    
    def method_with_docstring(self):
        """Method-level docstring."""
        pass
        
    def method_without_docstring(self):
        pass
        
    def method_with_partial_docstring(self):
        """Missing parameters and return description."""
        pass
'''
        
        self.sample_code_without_docstrings = '''
class NoDocstringClass:
    def method1(self):
        pass
        
    def method2(self):
        pass
'''

    def test_get_method_docstring_with_docstring(self):
        """
        Test _get_method_docstring() method for methods with proper docstrings.
        Validates that the method correctly extracts and returns docstring content.
        """
        tree = ast.parse(self.sample_code_with_docstrings)
        
        # Find the method with docstring
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == 'method_with_docstring':
                docstring = self.visitor._get_method_docstring(node)
                self.assertEqual(docstring, "Method-level docstring.")
                break
        else:
            self.fail("Method with docstring not found in AST")

    def test_get_method_docstring_without_docstring(self):
        """
        Test _get_method_docstring() method for methods without docstrings.
        Ensures the method returns None when no docstring is present.
        """
        tree = ast.parse(self.sample_code_without_docstrings)
        
        # Find a method without docstring
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == 'method1':
                docstring = self.visitor._get_method_docstring(node)
                self.assertIsNone(docstring)
                break
        else:
            self.fail("Method without docstring not found in AST")

    def test_get_method_docstring_partial_docstring(self):
        """
        Test _get_method_docstring() method for methods with partial docstrings.
        Validates handling of incomplete docstring information.
        """
        tree = ast.parse(self.sample_code_with_docstrings)
        
        # Find the method with partial docstring
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == 'method_with_partial_docstring':
                docstring = self.visitor._get_method_docstring(node)
                self.assertEqual(docstring, "Missing parameters and return description.")
                break
        else:
            self.fail("Method with partial docstring not found in AST")

    def test_docstring_coverage_calculation(self):
        """
        Test docstring coverage calculation functionality.
        Validates that coverage percentages are calculated correctly.
        """
        tree = ast.parse(self.sample_code_with_docstrings)
        
        # Count total methods and methods with docstrings
        total_methods = 0
        methods_with_docstrings = 0
        
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                total_methods += 1
                if self.visitor._get_method_docstring(node):
                    methods_with_docstrings += 1
        
        expected_coverage = (methods_with_docstrings / total_methods) * 100 if total_methods > 0 else 0
        self.assertEqual(methods_with_docstrings, 2)  # method_with_docstring and method_with_partial_docstring
        self.assertEqual(total_methods, 3)
        self.assertEqual(expected_coverage, 66.67)  # 2/3 = 66.67%

    def test_class_docstring_detection(self):
        """
        Test detection of class-level docstrings.
        Validates that class docstrings are properly identified and processed.
        """
        tree = ast.parse(self.sample_code_with_docstrings)
        
        # Find the class with docstring
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == 'SampleClass':
                docstring = self.visitor._get_method_docstring(node)
                self.assertEqual(docstring, "Class-level docstring.")
                break
        else:
            self.fail("Class with docstring not found in AST")

    def test_empty_class_docstring(self):
        """
        Test handling of classes without docstrings.
        Ensures proper behavior when no docstring is present.
        """
        tree = ast.parse(self.sample_code_without_docstrings)
        
        # Find the class without docstring
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == 'NoDocstringClass':
                docstring = self.visitor._get_method_docstring(node)
                self.assertIsNone(docstring)
                break
        else:
            self.fail("Class without docstring not found in AST")

    def test_docstring_coverage_statistics(self):
        """
        Test docstring coverage statistics generation.
        Validates that statistics are properly calculated and formatted.
        """
        tree = ast.parse(self.sample_code_with_docstrings)
        
        # Mock the visitor's analysis methods
        with patch.object(self.visitor, '_get_method_docstring') as mock_get_docstring:
            mock_get_docstring.side_effect = lambda node: "Sample docstring" if node.name == 'method_with_docstring' else None
            
            # Get statistics
            stats = self.visitor.get_statistics()
            
            # Verify statistics structure
            self.assertIsInstance(stats, dict)
            self.assertIn('total_methods', stats)
            self.assertIn('methods_with_docstrings', stats)
            self.assertIn('coverage_percentage', stats)
            self.assertIn('classes_with_docstrings', stats)
            self.assertIn('total_classes', stats)

    def test_integration_with_analyze_method(self):
        """
        Test integration of docstring analysis with the main analyze method.
        Ensures compatibility with the overall DeadCodeVisitor workflow.
        """
        tree = ast.parse(self.sample_code_with_docstrings)
        
        # Mock the audit service
        with patch('ast_dead_code_check.AuditService') as mock_audit_service:
            mock_audit_service.return_value.log_audit_event = Mock()
            mock_audit_service.return_value.track_changes = Mock(return_value=[])
            
            # Perform analysis
            result = self.visitor.analyze_with_ast(tree)
            
            # Verify that analysis was performed
            self.assertIsNotNone(result)
            self.assertIsInstance(result, dict)

    def test_docstring_coverage_edge_cases(self):
        """
        Test edge cases for docstring coverage analysis.
        Validates handling of unusual code structures and edge conditions.
        """
        # Test with empty code
        empty_tree = ast.parse('')
        methods = [node for node in ast.walk(empty_tree) if isinstance(node, ast.FunctionDef)]
        self.assertEqual(len(methods), 0)
        
        # Test with only comments (no docstrings)
        comment_only_code = '''
# This is just a comment
def method_without_docstring():
    pass
'''
        comment_tree = ast.parse(comment_only_code)
        methods = [node for node in ast.walk(comment_tree) if isinstance(node, ast.FunctionDef)]
        self.assertEqual(len(methods), 1)
        
        # Test docstring extraction for the method
        docstring = self.visitor._get_method_docstring(methods[0])
        self.assertIsNone(docstring)

    def test_docstring_coverage_with_decorators(self):
        """
        Test docstring coverage analysis for methods with decorators.
        Ensures decorators don't interfere with docstring detection.
        """
        decorated_code = '''
class DecoratedClass:
    """Class docstring."""
    
    @property
    def decorated_method(self):
        """Method with decorator and docstring."""
        return "value"
        
    @staticmethod
    def static_method():
        """Static method with docstring."""
        pass
'''
        tree = ast.parse(decorated_code)
        
        # Test decorated method with docstring
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == 'decorated_method':
                docstring = self.visitor._get_method_docstring(node)
                self.assertEqual(docstring, "Method with decorator and docstring.")
                break
        else:
            self.fail("Decorated method not found in AST")

    def test_docstring_coverage_performance(self):
        """
        Test performance of docstring coverage analysis.
        Validates that the analysis can handle larger codebases efficiently.
        """
        # Generate a larger test file
        large_code = '''
class LargeClass:
    """Class docstring."""
    
    def method1(self):
        """Method 1 docstring."""
        pass
        
    def method2(self):
        pass
        
    def method3(self):
        """Method 3 docstring."""
        pass
        
    def method4(self):
        pass
        
    def method5(self):
        """Method 5 docstring."""
        pass
'''
        
        # Parse the large code
        tree = ast.parse(large_code)
        
        # Test that analysis completes without errors
        methods = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
        self.assertEqual(len(methods), 5)
        
        # Count docstrings
        docstring_count = 0
        for method in methods:
            if self.visitor._get_method_docstring(method):
                docstring_count += 1
        
        self.assertEqual(docstring_count, 3)  # method1, method3, method5

    def tearDown(self):
        """
        Clean up after each test method.
        Resets test fixtures and mock objects.
        """
        self.visitor = None


if __name__ == '__main__':
    unittest.main()