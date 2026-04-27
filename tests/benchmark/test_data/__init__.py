"""
DeadCodeVisitor 性能基准测试数据模块

该模块提供不同规模代码库的测试数据生成和管理功能，
支持性能基准测试的资源消耗和响应时延评估。

模块功能：
1. 测试数据集管理（小型、中型、大型、超大型）
2. 性能数据收集器
3. 测试场景定义
4. 自动化执行支持

对应 SPEC: Phase 3: 性能优化与基准测试阶段
"""

import os
import json
import time
import psutil
import tempfile
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path
from enum import Enum


class CodeScale(Enum):
    """代码库规模分类"""
    SMALL = "small"      # < 1K 行
    MEDIUM = "medium"    # 1K-10K 行  
    LARGE = "large"      # 10K-100K 行
    EXTRA_LARGE = "extra_large"  # > 100K 行


@dataclass
class PerformanceMetrics:
    """性能指标数据结构"""
    execution_time: float          # 执行时间（秒）
    peak_memory_usage: float       # 峰值内存使用（MB）
    average_cpu_usage: float       # 平均CPU使用率（%）
    disk_io_read: int              # 磁盘读取量（字节）
    disk_io_write: int             # 磁盘写入量（字节）
    node_count: int                # AST节点数量
    edge_count: int                # 图边数量
    dead_code_count: int           # 死代码数量
    timestamp: float               # 时间戳


@dataclass
class TestDataset:
    """测试数据集信息"""
    name: str                      # 数据集名称
    scale: CodeScale               # 规模分类
    file_count: int                # 文件数量
    line_count: int                # 总行数
    estimated_dead_code_count: int # 预期死代码数量
    description: str               # 描述信息
    test_cases: List[str]          # 测试用例列表


class BenchmarkDataManager:
    """基准测试数据管理器"""
    
    def __init__(self, base_path: str = None):
        """
        初始化数据管理器
        
        Args:
            base_path: 基准测试数据根路径
        """
        self.base_path = Path(base_path or os.path.join(os.getcwd(), "tests", "benchmark", "test_data"))
        self.base_path.mkdir(parents=True, exist_ok=True)
        
        # 测试数据集配置
        self.datasets = self._initialize_datasets()
        
        # 性能数据存储
        self.performance_data = []
        
        # 系统监控
        self.process = psutil.Process()
        
    def _initialize_datasets(self) -> Dict[str, TestDataset]:
        """初始化测试数据集配置"""
        return {
            "small_basic": TestDataset(
                name="small_basic",
                scale=CodeScale.SMALL,
                file_count=5,
                line_count=500,
                estimated_dead_code_count=15,
                description="小型基础代码库，包含简单函数和类",
                test_cases=["basic_function_analysis", "simple_class_analysis"]
            ),
            "medium_mixed": TestDataset(
                name="medium_mixed",
                scale=CodeScale.MEDIUM,
                file_count=20,
                line_count=5000,
                estimated_dead_code_count=80,
                description="中型混合代码库，包含多种编程模式",
                test_cases=["mixed_async_sync_analysis", "import_analysis", "decorator_analysis"]
            ),
            "large_framework": TestDataset(
                name="large_framework",
                scale=CodeScale.LARGE,
                file_count=100,
                line_count=50000,
                estimated_dead_code_count=500,
                description="大型框架代码库，模拟真实项目结构",
                test_cases=["framework_analysis", "module_dependency_analysis", "circular_import_detection"]
            ),
            "extra_large_enterprise": TestDataset(
                name="extra_large_enterprise",
                scale=CodeScale.EXTRA_LARGE,
                file_count=500,
                line_count=200000,
                estimated_dead_code_count=2000,
                description="超大型企业级代码库，包含复杂依赖关系",
                test_cases=["enterprise_analysis", "multi_package_analysis", "legacy_code_analysis"]
            )
        }
    
    def get_dataset(self, name: str) -> Optional[TestDataset]:
        """获取指定数据集"""
        return self.datasets.get(name)
    
    def list_datasets(self) -> List[TestDataset]:
        """列出所有可用数据集"""
        return list(self.datasets.values())
    
    def get_datasets_by_scale(self, scale: CodeScale) -> List[TestDataset]:
        """按规模筛选数据集"""
        return [dataset for dataset in self.datasets.values() if dataset.scale == scale]
    
    def create_test_environment(self, dataset_name: str) -> str:
        """
        为指定数据集创建测试环境
        
        Args:
            dataset_name: 数据集名称
            
        Returns:
            测试环境临时目录路径
        """
        dataset = self.get_dataset(dataset_name)
        if not dataset:
            raise ValueError(f"Dataset '{dataset_name}' not found")
        
        # 创建临时测试目录
        temp_dir = tempfile.mkdtemp(prefix=f"benchmark_{dataset_name}_")
        
        # 生成测试代码文件
        self._generate_test_code(temp_dir, dataset)
        
        return temp_dir
    
    def _generate_test_code(self, temp_dir: str, dataset: TestDataset):
        """生成测试代码文件"""
        # 这里应该根据数据集配置生成相应的测试代码
        # 为了演示，我们创建一些基本的Python文件
        
        code_templates = {
            "small_basic": [
                "# 小型基础代码库示例\n",
                "def simple_function():\n    pass\n\n",
                "class SimpleClass:\n    def method1(self):\n        pass\n\n",
                "def another_function():\n    # 死代码示例\n    unused_variable = 42\n    return None\n\n"
            ],
            "medium_mixed": [
                "# 中型混合代码库示例\n",
                "import asyncio\nimport json\nfrom typing import List\n\n",
                "async def async_function():\n    await asyncio.sleep(0.1)\n    return \"async_result\"\n\n",
                "def sync_function():\n    data = json.loads('{}')\n    return data\n\n"
            ]
        }
        
        # 根据数据集规模生成相应数量的文件
        template = code_templates.get(dataset.name, ["# 通用测试代码\n", "def test_function():\n    pass\n\n"])
        
        for i in range(min(dataset.file_count, len(template))):
            file_path = os.path.join(temp_dir, f"module_{i}.py")
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(template[i % len(template)])
    
    def collect_performance_metrics(self, start_time: float, 
                                 node_count: int, 
                                 edge_count: int, 
                                 dead_code_count: int) -> PerformanceMetrics:
        """
        收集性能指标
        
        Args:
            start_time: 开始时间
            node_count: AST节点数量
            edge_count: 图边数量
            dead_code_count: 死代码数量
            
        Returns:
            性能指标对象
        """
        end_time = time.time()
        execution_time = end_time - start_time
        
        # 获取内存使用情况
        memory_info = self.process.memory_info()
        peak_memory_usage = memory_info.rss / 1024 / 1024  # 转换为MB
        
        # 获取CPU使用情况
        cpu_percent = self.process.cpu_percent()
        
        # 获取磁盘I/O情况
        io_counters = self.process.io_counters()
        disk_io_read = io_counters.read_bytes if io_counters else 0
        disk_io_write = io_counters.write_bytes if io_counters else 0
        
        metrics = PerformanceMetrics(
            execution_time=execution_time,
            peak_memory_usage=peak_memory_usage,
            average_cpu_usage=cpu_percent,
            disk_io_read=disk_io_read,
            disk_io_write=disk_io_write,
            node_count=node_count,
            edge_count=edge_count,
            dead_code_count=dead_code_count,
            timestamp=end_time
        )
        
        self.performance_data.append(metrics)
        return metrics
    
    def save_performance_report(self, output_path: str = None):
        """保存性能报告"""
        if not output_path:
            output_path = self.base_path / "performance_report.json"
        
        report = {
            "total_tests": len(self.performance_data),
            "datasets": [asdict(dataset) for dataset in self.datasets.values()],
            "performance_data": [asdict(metrics) for metrics in self.performance_data],
            "summary": self._generate_summary()
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
    
    def _generate_summary(self) -> Dict[str, Any]:
        """生成性能摘要"""
        if not self.performance_data:
            return {}
        
        total_time = sum(m.execution_time for m in self.performance_data)
        avg_memory = sum(m.peak_memory_usage for m in self.performance_data) / len(self.performance_data)
        avg_cpu = sum(m.average_cpu_usage for m in self.performance_data) / len(self.performance_data)
        
        return {
            "total_execution_time": total_time,
            "average_memory_usage_mb": avg_memory,
            "average_cpu_usage_percent": avg_cpu,
            "total_nodes_analyzed": sum(m.node_count for m in self.performance_data),
            "total_edges_analyzed": sum(m.edge_count for m in self.performance_data),
            "total_dead_code_found": sum(m.dead_code_count for m in self.performance_data)
        }
    
    def clear_performance_data(self):
        """清除性能数据"""
        self.performance_data.clear()
    
    def get_performance_trends(self) -> Dict[str, List[float]]:
        """获取性能趋势数据"""
        trends = {
            "execution_time": [m.execution_time for m in self.performance_data],
            "memory_usage": [m.peak_memory_usage for m in self.performance_data],
            "cpu_usage": [m.average_cpu_usage for m in self.performance_data],
            "dead_code_count": [m.dead_code_count for m in self.performance_data]
        }
        return trends


# 全局数据管理器实例
benchmark_manager = BenchmarkDataManager()


def get_benchmark_manager() -> BenchmarkDataManager:
    """获取全局基准测试数据管理器"""
    return benchmark_manager


def list_available_datasets() -> List[str]:
    """列出所有可用的测试数据集"""
    return list(benchmark_manager.datasets.keys())


def get_dataset_info(dataset_name: str) -> Dict[str, Any]:
    """获取数据集信息"""
    dataset = benchmark_manager.get_dataset(dataset_name)
    if not dataset:
        return {}
    
    return {
        "name": dataset.name,
        "scale": dataset.scale.value,
        "file_count": dataset.file_count,
        "line_count": dataset.line_count,
        "estimated_dead_code_count": dataset.estimated_dead_code_count,
        "description": dataset.description,
        "test_cases": dataset.test_cases
    }


# 导出常用功能
__all__ = [
    "CodeScale",
    "PerformanceMetrics", 
    "TestDataset",
    "BenchmarkDataManager",
    "benchmark_manager",
    "get_benchmark_manager",
    "list_available_datasets",
    "get_dataset_info"
]