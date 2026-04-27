"""
DeadCodeVisitor 性能基准测试 - 资源监控模块

该模块提供 DeadCodeVisitor 在不同规模代码库上的资源消耗监控功能，
包括 CPU、内存、磁盘 I/O 等关键性能指标的采集和分析。

对应 SPEC: Phase 3: 性能优化与基准测试阶段
验收测试基准: ATB-3 (资源消耗测试)
"""

import time
import psutil
import threading
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from contextlib import contextmanager
from memory_profiler import memory_usage
import tracemalloc
import json
import os
from datetime import datetime


@dataclass
class ResourceMetrics:
    """资源指标数据结构"""
    timestamp: float
    memory_peak_mb: float
    memory_current_mb: float
    cpu_percent: float
    disk_read_mb: float
    disk_write_mb: float
    execution_time_ms: float
    lines_analyzed: int = 0
    files_processed: int = 0


@dataclass
class BenchmarkResult:
    """基准测试结果"""
    test_name: str
    test_size: str  # small, medium, large, xlarge
    total_execution_time: float
    peak_memory_mb: float
    average_cpu_percent: float
    total_disk_io_mb: float
    lines_per_second: float
    files_per_second: float
    metrics: List[ResourceMetrics] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式，便于序列化"""
        return {
            'test_name': self.test_name,
            'test_size': self.test_size,
            'total_execution_time': self.total_execution_time,
            'peak_memory_mb': self.peak_memory_mb,
            'average_cpu_percent': self.average_cpu_percent,
            'total_disk_io_mb': self.total_disk_io_mb,
            'lines_per_second': self.lines_per_second,
            'files_per_second': self.files_per_second,
            'metrics_count': len(self.metrics),
            'timestamp': datetime.now().isoformat()
        }


class ResourceMonitor:
    """资源监控器 - 实时监控 DeadCodeVisitor 的资源消耗"""
    
    def __init__(self, process_id: Optional[int] = None):
        """
        初始化资源监控器
        
        Args:
            process_id: 要监控的进程ID，默认为当前进程
        """
        self.process_id = process_id or os.getpid()
        self.process = psutil.Process(self.process_id)
        self.logger = logging.getLogger(__name__)
        self._monitoring = False
        self._monitor_thread = None
        self._metrics_buffer: List[ResourceMetrics] = []
        self._start_time = 0
        self._start_memory = 0
        
        # 启动内存跟踪
        tracemalloc.start()
        
    def start_monitoring(self) -> None:
        """开始资源监控"""
        if self._monitoring:
            return
            
        self._monitoring = True
        self._metrics_buffer.clear()
        self._start_time = time.time()
        self._start_memory = self._get_current_memory()
        
        self._monitor_thread = threading.Thread(target=self._monitor_loop)
        self._monitor_thread.daemon = True
        self._monitor_thread.start()
        
        self.logger.info(f"Started resource monitoring for process {self.process_id}")
    
    def stop_monitoring(self) -> List[ResourceMetrics]:
        """停止资源监控并收集结果"""
        if not self._monitoring:
            return self._metrics_buffer
            
        self._monitoring = False
        
        if self._monitor_thread and self._monitor_thread.is_alive():
            self._monitor_thread.join(timeout=1.0)
            
        self.logger.info(f"Stopped resource monitoring, collected {len(self._metrics_buffer)} metrics")
        return self._metrics_buffer
    
    def _monitor_loop(self) -> None:
        """监控循环 - 定期采集资源指标"""
        interval = 0.1  # 100ms 采集间隔
        
        while self._monitoring:
            try:
                metric = self._collect_metric()
                self._metrics_buffer.append(metric)
            except Exception as e:
                self.logger.error(f"Error collecting metric: {e}")
                
            time.sleep(interval)
    
    def _collect_metric(self) -> ResourceMetrics:
        """采集单个资源指标"""
        current_time = time.time()
        
        # 内存指标
        memory_info = self.process.memory_info()
        memory_current_mb = memory_info.rss / 1024 / 1024  # 转换为MB
        
        # CPU指标
        cpu_percent = self.process.cpu_percent(interval=0.1)
        
        # 磁盘I/O指标
        disk_io = self.process.io_counters()
        disk_read_mb = disk_io.read_bytes / 1024 / 1024 if disk_io.read_bytes else 0
        disk_write_mb = disk_io.write_bytes / 1024 / 1024 if disk_io.write_bytes else 0
        
        # 执行时间
        execution_time_ms = (current_time - self._start_time) * 1000
        
        return ResourceMetrics(
            timestamp=current_time,
            memory_peak_mb=self._get_peak_memory(),
            memory_current_mb=memory_current_mb,
            cpu_percent=cpu_percent,
            disk_read_mb=disk_read_mb,
            disk_write_mb=disk_write_mb,
            execution_time_ms=execution_time_ms
        )
    
    def _get_current_memory(self) -> float:
        """获取当前内存使用量(MB)"""
        return self.process.memory_info().rss / 1024 / 1024
    
    def _get_peak_memory(self) -> float:
        """获取峰值内存使用量(MB)"""
        current, peak = tracemalloc.get_traced_memory()
        return peak / 1024 / 1024
    
    @contextmanager
    def monitor_performance(self, test_name: str = "unknown"):
        """性能监控上下文管理器"""
        self.start_monitoring()
        try:
            yield self
        finally:
            metrics = self.stop_monitoring()
            self.logger.info(f"Performance monitoring completed for {test_name}")
            return metrics


class PerformanceProfiler:
    """性能分析器 - 专门用于 DeadCodeVisitor 的性能分析"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.results: List[BenchmarkResult] = []
        
    def profile_dead_code_analysis(self, 
                                 visitor, 
                                 test_data: Dict[str, Any], 
                                 test_size: str) -> BenchmarkResult:
        """
        分析 DeadCodeVisitor 的性能表现
        
        Args:
            visitor: DeadCodeVisitor 实例
            test_data: 测试数据，包含代码文件和预期结果
            test_size: 测试规模 (small, medium, large, xlarge)
            
        Returns:
            BenchmarkResult: 性能分析结果
        """
        test_name = f"dead_code_analysis_{test_size}"
        
        with ResourceMonitor() as monitor:
            start_time = time.time()
            
            # 执行 DeadCodeVisitor 分析
            try:
                result = visitor.analyze(test_data['code_files'])
                analysis_success = True
            except Exception as e:
                self.logger.error(f"Analysis failed: {e}")
                analysis_success = False
                result = None
            
            end_time = time.time()
            total_time = end_time - start_time
            
            # 收集监控指标
            metrics = monitor.stop_monitoring()
            
            if analysis_success and metrics:
                # 计算性能指标
                peak_memory = max(m.memory_peak_mb for m in metrics)
                avg_cpu = sum(m.cpu_percent for m in metrics) / len(metrics)
                total_disk_io = metrics[-1].disk_read_mb + metrics[-1].disk_write_mb
                
                # 计算吞吐量
                lines_analyzed = test_data.get('total_lines', 0)
                files_processed = len(test_data.get('code_files', []))
                
                lines_per_second = lines_analyzed / total_time if total_time > 0 else 0
                files_per_second = files_processed / total_time if total_time > 0 else 0
                
                benchmark_result = BenchmarkResult(
                    test_name=test_name,
                    test_size=test_size,
                    total_execution_time=total_time,
                    peak_memory_mb=peak_memory,
                    average_cpu_percent=avg_cpu,
                    total_disk_io_mb=total_disk_io,
                    lines_per_second=lines_per_second,
                    files_per_second=files_per_second,
                    metrics=metrics
                )
                
                self.results.append(benchmark_result)
                return benchmark_result
            else:
                # 分析失败，返回失败结果
                return BenchmarkResult(
                    test_name=test_name,
                    test_size=test_size,
                    total_execution_time=total_time,
                    peak_memory_mb=0,
                    average_cpu_percent=0,
                    total_disk_io_mb=0,
                    lines_per_second=0,
                    files_per_second=0,
                    metrics=[]
                )
    
    def generate_performance_report(self) -> Dict[str, Any]:
        """生成性能报告"""
        if not self.results:
            return {"error": "No benchmark results available"}
        
        report = {
            "summary": {
                "total_tests": len(self.results),
                "test_sizes": list(set(r.test_size for r in self.results)),
                "average_execution_time": sum(r.total_execution_time for r in self.results) / len(self.results),
                "average_peak_memory": sum(r.peak_memory_mb for r in self.results) / len(self.results),
                "average_cpu_usage": sum(r.average_cpu_percent for r in self.results) / len(self.results)
            },
            "detailed_results": [result.to_dict() for result in self.results],
            "performance_trends": self._analyze_performance_trends()
        }
        
        return report
    
    def _analyze_performance_trends(self) -> Dict[str, Any]:
        """分析性能趋势"""
        size_order = ["small", "medium", "large", "xlarge"]
        size_results = {size: [] for size in size_order}
        
        for result in self.results:
            if result.test_size in size_results:
                size_results[result.test_size].append(result)
        
        trends = {}
        for size in size_order:
            if size_results[size]:
                results = size_results[size]
                trends[size] = {
                    "avg_execution_time": sum(r.total_execution_time for r in results) / len(results),
                    "avg_peak_memory": sum(r.peak_memory_mb for r in results) / len(results),
                    "avg_lines_per_second": sum(r.lines_per_second for r in results) / len(results),
                    "sample_count": len(results)
                }
        
        return trends
    
    def save_results_to_file(self, filename: str) -> None:
        """保存结果到文件"""
        report = self.generate_performance_report()
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"Performance results saved to {filename}")


def create_test_data_sizes() -> Dict[str, Dict[str, Any]]:
    """创建不同规模的测试数据集"""
    return {
        "small": {
            "description": "小型代码库 (<1K行)",
            "total_lines": 500,
            "code_files": ["small_test.py"],
            "expected_dead_code_ratio": 0.1
        },
        "medium": {
            "description": "中型代码库 (1K-10K行)", 
            "total_lines": 5000,
            "code_files": ["medium_test_1.py", "medium_test_2.py"],
            "expected_dead_code_ratio": 0.15
        },
        "large": {
            "description": "大型代码库 (10K-100K行)",
            "total_lines": 50000,
            "code_files": ["large_test_1.py", "large_test_2.py", "large_test_3.py"],
            "expected_dead_code_ratio": 0.2
        },
        "xlarge": {
            "description": "超大型代码库 (>100K行)",
            "total_lines": 200000,
            "code_files": ["xlarge_test_1.py", "xlarge_test_2.py", "xlarge_test_3.py", "xlarge_test_4.py"],
            "expected_dead_code_ratio": 0.25
        }
    }


# 验收测试基准 ATB-3: 资源消耗测试
def test_resource_monitoring():
    """测试资源监控功能"""
    print("🧪 Testing Resource Monitoring Functionality")
    
    # 创建监控器
    monitor = ResourceMonitor()
    
    # 模拟工作负载
    monitor.start_monitoring()
    
    # 模拟一些计算密集型工作
    import time
    start = time.time()
    while time.time() - start < 2:  # 运行2秒
        _ = [x**2 for x in range(1000)]
    
    metrics = monitor.stop_monitoring()
    
    print(f"✅ Collected {len(metrics)} metrics")
    print(f"✅ Peak memory: {max(m.memory_peak_mb for m in metrics):.2f} MB")
    print(f"✅ Average CPU: {sum(m.cpu_percent for m in metrics) / len(metrics):.2f}%")
    
    return len(metrics) > 0


def test_performance_profiler():
    """测试性能分析器"""
    print("🧪 Testing Performance Profiler")
    
    profiler = PerformanceProfiler()
    
    # 创建模拟的 DeadCodeVisitor
    class MockVisitor:
        def analyze(self, files):
            # 模拟分析工作
            import time
            time.sleep(0.1)
            return {"dead_code": [], "total_files": len(files)}
    
    # 创建测试数据
    test_data = create_test_data_sizes()
    
    # 运行性能分析
    for size, data in test_data.items():
        print(f"📊 Running {size} scale test...")
        result = profiler.profile_dead_code_analysis(
            MockVisitor(), 
            data, 
            size
        )
        print(f"✅ {size} test completed in {result.total_execution_time:.3f}s")
    
    # 生成报告
    report = profiler.generate_performance_report()
    print(f"✅ Generated performance report with {len(report['detailed_results'])} results")
    
    return len(profiler.results) > 0


if __name__ == "__main__":
    # 配置日志
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    print("🚀 Starting DeadCodeVisitor Resource Monitor Tests")
    
    # 运行测试
    test1_passed = test_resource_monitoring()
    test2_passed = test_performance_profiler()
    
    print(f"\n📋 Test Results:")
    print(f"Resource Monitoring: {'✅ PASSED' if test1_passed else '❌ FAILED'}")
    print(f"Performance Profiler: {'✅ PASSED' if test2_passed else '❌ FAILED'}")
    
    if test1_passed and test2_passed:
        print("🎉 All tests passed!")
    else:
        print("⚠️ Some tests failed. Check the logs for details.")