"""
小型代码库测试数据集 - 用于 DeadCodeVisitor 性能基准测试

此数据集包含小型项目（<1K行）的代码样本，用于测试 DeadCodeVisitor
在小型代码库上的性能表现和资源消耗。

数据集特点：
- 代码规模：小型（<1K行）
- 包含常见的 Python 代码结构
- 包含预期的死代码标记
- 用于性能基准测试和回归测试
"""

from .sample_project import SampleProject
from .dead_code_markers import DeadCodeMarkers

__all__ = ['SampleProject', 'DeadCodeMarkers']