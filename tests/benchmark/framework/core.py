"""
DeadCodeVisitor 性能基准测试框架核心模块

该模块实现了基准测试的基础设施，包括：
- 基准测试框架核心类
- 测试数据集管理机制
- 性能数据收集器
- 资源消耗监控模块
- 时延测量组件
- 性能数据存储机制

对应 SPEC Phase 3: 性能优化与基准测试阶段
"""

import os
import sys
import time
import json
import psutil
import threading
import tempfile
import shutil
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Callable
from enum import Enum
from pathlib import Path
from contextlib import contextmanager
from memory_profiler import memory_usage
import timeit
import csv
import logging
from datetime import datetime

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CodeScale(Enum):
    """代码库规模分类"""
    SMALL = "small"      # < 1K 行
    MEDIUM = "medium"    # 1K-10K 行
    LARGE = "large"      # 10K-100K 行
    EXTRA_LARGE = "extra_large"  # > 100K 行


class BenchmarkMetric(Enum):
    """基准测试指标类型"""
    EXECUTION_TIME = "execution_time"
    MEMORY_PEAK = "memory_peak"
    MEMORY_AVG = "memory_avg"
    CPU_USAGE = "cpu_usage"
    DISK_IO = "disk_io"
    NODE_COUNT = "node_count"
    EDGE_COUNT = "edge_count"


@dataclass
class BenchmarkResult:
    """基准测试结果数据类"""
    test_id: str
    scale: CodeScale
    metrics: Dict[BenchmarkMetric, float]
    execution_time: float
    memory_peak: float
    memory_avg: float
    cpu_usage: float
    node_count: int
    edge_count: int
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TestDataset:
    """测试数据集"""
    name: str
    scale: CodeScale
    file_count: int
    total_lines: int
    file_paths: List[str]
    description: str = ""
    expected_dead_code_count: int = 0


class PerformanceMonitor:
    """性能监控器"""
    
    def __init__(self):
        self.process = psutil.Process()
        self.initial_memory = self.process.memory_info().rss / 1024 / 1024  # MB
        self.cpu_percentages = []
        self.disk_io_start = None
        self.disk_io_end = None
        
    def start_monitoring(self):
        """开始监控"""
        self.disk_io_start = self.process.io_counters()
        
    def stop_monitoring(self):
        """停止监控"""
        self.disk_io_end = self.process.io_counters()
        
    def get_cpu_usage(self):
        """获取CPU使用率"""
        try:
            return self.process.cpu_percent(interval=0.1)
        except:
            return 0.0
            
    def get_memory_usage(self):
        """获取内存使用情况"""
        current_memory = self.process.memory_info().rss / 1024 / 1024  # MB
        return current_memory - self.initial_memory


class BenchmarkFramework(ABC):
    """基准测试框架抽象基类"""
    
    def __init__(self, output_dir: str = "benchmark_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.results: List[BenchmarkResult] = []
        self.datasets: List[TestDataset] = []
        self.monitor = PerformanceMonitor()
        
    @abstractmethod
    def setup_test_environment(self) -> None:
        """设置测试环境"""
        pass
        
    @abstractmethod
    def load_test_datasets(self) -> List[TestDataset]:
        """加载测试数据集"""
        pass
        
    @abstractmethod
    def run_benchmark(self, dataset: TestDataset) -> BenchmarkResult:
        """运行基准测试"""
        pass
        
    def add_dataset(self, dataset: TestDataset):
        """添加测试数据集"""
        self.datasets.append(dataset)
        
    def run_all_benchmarks(self) -> List[BenchmarkResult]:
        """运行所有基准测试"""
        logger.info("开始运行基准测试...")
        
        for dataset in self.datasets:
            logger.info(f"测试数据集: {dataset.name} ({dataset.scale.value})")
            result = self.run_benchmark(dataset)
            self.results.append(result)
            
        logger.info(f"基准测试完成，共 {len(self.results)} 个结果")
        return self.results
        
    def save_results(self, filename: str = None):
        """保存测试结果"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"benchmark_results_{timestamp}.json"
            
        filepath = self.output_dir / filename
        
        results_data = {
            "timestamp": datetime.now().isoformat(),
            "total_tests": len(self.results),
            "results": [
                {
                    "test_id": result.test_id,
                    "scale": result.scale.value,
                    "metrics": {metric.value: value for metric, value in result.metrics.items()},
                    "execution_time": result.execution_time,
                    "memory_peak": result.memory_peak,
                    "memory_avg": result.memory_avg,
                    "cpu_usage": result.cpu_usage,
                    "node_count": result.node_count,
                    "edge_count": result.edge_count,
                    "timestamp": result.timestamp.isoformat(),
                    "metadata": result.metadata
                }
                for result in self.results
            ]
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(results_data, f, indent=2, ensure_ascii=False)
            
        logger.info(f"结果已保存到: {filepath}")
        return filepath
        
    def generate_csv_report(self, filename: str = None):
        """生成CSV报告"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"benchmark_report_{timestamp}.csv"
            
        filepath = self.output_dir / filename
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'Test ID', 'Scale', 'Execution Time (s)', 'Memory Peak (MB)', 
                'Memory Avg (MB)', 'CPU Usage (%)', 'Node Count', 'Edge Count', 'Timestamp'
            ])
            
            for result in self.results:
                writer.writerow([
                    result.test_id,
                    result.scale.value,
                    result.execution_time,
                    result.memory_peak,
                    result.memory_avg,
                    result.cpu_usage,
                    result.node_count,
                    result.edge_count,
                    result.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                ])
                
        logger.info(f"CSV报告已保存到: {filepath}")
        return filepath


class DeadCodeVisitorBenchmark(BenchmarkFramework):
    """DeadCodeVisitor 基准测试实现"""
    
    def __init__(self, output_dir: str = "benchmark_results"):
        super().__init__(output_dir)
        self.dead_code_visitor = None
        
    def setup_test_environment(self):
        """设置测试环境"""
        try:
            # 导入DeadCodeVisitor
            sys.path.append(str(Path(__file__).parent.parent.parent / "scripts"))
            from ast_dead_code_check import DeadCodeVisitor
            
            self.dead_code_visitor = DeadCodeVisitor()
            logger.info("测试环境设置完成")
            
        except ImportError as e:
            logger.error(f"无法导入DeadCodeVisitor: {e}")
            raise
            
    def load_test_datasets(self) -> List[TestDataset]:
        """加载测试数据集"""
        datasets = []
        
        # 小型测试集
        small_dataset = TestDataset(
            name="small_project",
            scale=CodeScale.SMALL,
            file_count=5,
            total_lines=500,
            file_paths=["tests/fixtures/small_*.py"],
            description="小型项目测试集",
            expected_dead_code_count=3
        )
        
        # 中型测试集
        medium_dataset = TestDataset(
            name="medium_project",
            scale=CodeScale.MEDIUM,
            file_count=15,
            total_lines=5000,
            file_paths=["tests/fixtures/medium_*.py"],
            description="中型项目测试集",
            expected_dead_code_count=15
        )
        
        # 大型测试集
        large_dataset = TestDataset(
            name="large_project",
            scale=CodeScale.LARGE,
            file_count=50,
            total_lines=50000,
            file_paths=["tests/fixtures/large_*.py"],
            description="大型项目测试集",
            expected_dead_code_count=50
        )
        
        # 超大型测试集
        extra_large_dataset = TestDataset(
            name="extra_large_project",
            scale=CodeScale.EXTRA_LARGE,
            file_count=200,
            total_lines=200000,
            file_paths=["tests/fixtures/extra_large_*.py"],
            description="超大型项目测试集",
            expected_dead_code_count=200
        )
        
        datasets.extend([small_dataset, medium_dataset, large_dataset, extra_large_dataset])
        
        # 添加到框架
        for dataset in datasets:
            self.add_dataset(dataset)
            
        logger.info(f"已加载 {len(datasets)} 个测试数据集")
        return datasets
        
    def run_benchmark(self, dataset: TestDataset) -> BenchmarkResult:
        """运行基准测试"""
        test_id = f"{dataset.name}_{dataset.scale.value}_{int(time.time())}"
        
        logger.info(f"开始基准测试: {test_id}")
        
        # 开始监控
        self.monitor.start_monitoring()
        
        try:
            # 测试执行时间
            execution_time = timeit.timeit(
                lambda: self._analyze_dataset(dataset),
                number=1
            )
            
            # 测试内存使用
            memory_usage_stats = memory_usage(
                (self._analyze_dataset, (dataset,)),
                interval=0.1,
                timeout=None
            )
            
            memory_peak = max(memory_usage_stats)
            memory_avg = sum(memory_usage_stats) / len(memory_usage_stats)
            
            # 测试CPU使用率
            cpu_usage = self.monitor.get_cpu_usage()
            
            # 获取分析结果
            analysis_result = self._analyze_dataset(dataset)
            node_count = len(analysis_result.get_all_nodes())
            edge_count = len(analysis_result.get_edges())
            
            # 创建结果对象
            result = BenchmarkResult(
                test_id=test_id,
                scale=dataset.scale,
                metrics={
                    BenchmarkMetric.EXECUTION_TIME: execution_time,
                    BenchmarkMetric.MEMORY_PEAK: memory_peak,
                    BenchmarkMetric.MEMORY_AVG: memory_avg,
                    BenchmarkMetric.CPU_USAGE: cpu_usage,
                    BenchmarkMetric.NODE_COUNT: node_count,
                    BenchmarkMetric.EDGE_COUNT: edge_count
                },
                execution_time=execution_time,
                memory_peak=memory_peak,
                memory_avg=memory_avg,
                cpu_usage=cpu_usage,
                node_count=node_count,
                edge_count=edge_count,
                metadata={
                    "dataset_name": dataset.name,
                    "file_count": dataset.file_count,
                    "total_lines": dataset.total_lines,
                    "expected_dead_code_count": dataset.expected_dead_code_count
                }
            )
            
            logger.info(f"基准测试完成: {test_id}")
            return result
            
        except Exception as e:
            logger.error(f"基准测试失败: {test_id}, 错误: {e}")
            raise
            
        finally:
            # 停止监控
            self.monitor.stop_monitoring()
            
    def _analyze_dataset(self, dataset: TestDataset):
        """分析数据集"""
        # 这里应该实现实际的代码分析逻辑
        # 为了演示，我们模拟分析过程
        time.sleep(0.1)  # 模拟分析时间
        
        # 返回模拟的分析结果
        class MockAnalysisResult:
            def get_all_nodes(self):
                return [{"id": f"node_{i}", "type": "function"} for i in range(10)]
                
            def get_edges(self):
                return [{"source": "node_0", "target": "node_1"}]
                
        return MockAnalysisResult()


class BenchmarkRunner:
    """基准测试运行器"""
    
    def __init__(self, framework: BenchmarkFramework):
        self.framework = framework
        
    def run_performance_regression_test(self, baseline_results: List[BenchmarkResult]) -> Dict[str, Any]:
        """运行性能回归测试"""
        logger.info("开始性能回归测试...")
        
        current_results = self.framework.run_all_benchmarks()
        
        regression_report = {
            "baseline_tests": len(baseline_results),
            "current_tests": len(current_results),
            "regressions": [],
            "improvements": [],
            "summary": {}
        }
        
        # 比较结果
        for current in current_results:
            baseline = next(
                (b for b in baseline_results 
                 if b.scale == current.scale and b.test_id.split('_')[0] == current.test_id.split('_')[0]),
                None
            )
            
            if baseline:
                # 比较执行时间
                time_change = (current.execution_time - baseline.execution_time) / baseline.execution_time * 100
                
                if time_change > 10:  # 性能退化超过10%
                    regression_report["regressions"].append({
                        "test_id": current.test_id,
                        "scale": current.scale.value,
                        "time_change_percent": time_change,
                        "baseline_time": baseline.execution_time,
                        "current_time": current.execution_time
                    })
                elif time_change < -10:  # 性能提升超过10%
                    regression_report["improvements"].append({
                        "test_id": current.test_id,
                        "scale": current.scale.value,
                        "time_change_percent": time_change,
                        "baseline_time": baseline.execution_time,
                        "current_time": current.execution_time
                    })
        
        # 生成摘要
        regression_report["summary"] = {
            "total_regressions": len(regression_report["regressions"]),
            "total_improvements": len(regression_report["improvements"]),
            "performance_stable": len(regression_report["regressions"]) == 0
        }
        
        logger.info(f"性能回归测试完成，发现 {len(regression_report['regressions'])} 个性能退化")
        return regression_report


# 工厂函数
def create_benchmark_framework(framework_type: str = "deadcode", output_dir: str = "benchmark_results") -> BenchmarkFramework:
    """创建基准测试框架实例"""
    if framework_type == "deadcode":
        return DeadCodeVisitorBenchmark(output_dir)
    else:
        raise ValueError(f"不支持的框架类型: {framework_type}")


# 使用示例
if __name__ == "__main__":
    # 创建基准测试框架
    framework = create_benchmark_framework()
    
    # 设置测试环境
    framework.setup_test_environment()
    
    # 加载测试数据集
    framework.load_test_datasets()
    
    # 运行基准测试
    results = framework.run_all_benchmarks()
    
    # 保存结果
    framework.save_results()
    framework.generate_csv_report()
    
    # 生成性能报告
    runner = BenchmarkRunner(framework)
    regression_report = runner.run_performance_regression_test([])
    
    print("基准测试完成！")