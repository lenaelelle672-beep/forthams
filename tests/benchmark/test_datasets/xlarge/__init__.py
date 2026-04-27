"""
超大型代码库基准测试数据集
用于测试 DeadCodeVisitor 在超大规模代码库（>100K行）上的性能表现
"""

__all__ = [
    'generate_xlarge_project',
    'generate_mixed_codebase',
    'generate_large_framework',
    'get_xlarge_test_cases'
]