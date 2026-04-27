"""
Large Dataset Benchmark Test Suite

This module contains large-scale code datasets (10K-100K lines) for DeadCodeVisitor
performance benchmarking. Each dataset represents different complexity levels
and code patterns commonly found in real-world applications.

Dataset Categories:
- enterprise_app: Large enterprise application with multiple modules
- web_framework: Web framework with extensive middleware and routing
- data_pipeline: Data processing pipeline with complex transformations
- ml_project: Machine learning project with multiple training pipelines
"""

__all__ = [
    'enterprise_app',
    'web_framework', 
    'data_pipeline',
    'ml_project'
]