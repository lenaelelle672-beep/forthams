"""
DeadCodeVisitor 性能基准测试框架

本模块提供 DeadCodeVisitor 在不同规模代码库上的性能基准测试功能，
包括资源消耗监控、响应时延测量和性能报告生成。

## 功能特性

- 多规模代码库测试（小型<1K行，中型1K-10K行，大型10K-100K行，超大型>100K行）
- 资源消耗监控（CPU、内存、磁盘I/O）
- 响应时延测量和分析
- 性能回归检测
- 可视化报告生成

## 使用示例

```python
from tests.benchmark import BenchmarkRunner

# 创建基准测试运行器
runner = BenchmarkRunner()

# 运行完整基准测试
runner.run_full_benchmark()

# 运行特定规模的测试
runner.run_scale_benchmark('medium')

# 生成性能报告
runner.generate_report()
```

## 测试场景

- small: 小型代码库 (<1K 行)
- medium: 中型代码库 (1K-10K 行)  
- large: 大型代码库 (10K-100K 行)
- xlarge: 超大型代码库 (>100K 行)
"""

import os
import sys
import time
import json
import psutil
import tempfile
import threading
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# 导入 DeadCodeVisitor
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from scripts.ast_dead_code_check import DeadCodeVisitor, analyze_with_ast


@dataclass
class BenchmarkMetrics:
    """基准测试指标数据类"""
    scale: str
    execution_time: float
    peak_memory_usage: float
    average_cpu_usage: float
    total_files_processed: int
    total_lines_analyzed: int
    dead_code_count: int
    timestamp: str
    disk_io_read: float
    disk_io_write: float


@dataclass
class BenchmarkConfig:
    """基准测试配置"""
    test_data_dir: str
    output_dir: str
    scales: List[str]
    iterations: int = 3
    timeout: int = 300
    enable_profiling: bool = True
    enable_memory_profiling: bool = True


class ResourceMonitor:
    """资源监控器"""
    
    def __init__(self):
        self.process = psutil.Process()
        self.monitoring = False
        self.monitor_thread = None
        self.metrics = {
            'cpu_usage': [],
            'memory_usage': [],
            'disk_io_read': 0,
            'disk_io_write': 0
        }
    
    def start_monitoring(self):
        """开始监控"""
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_resources)
        self.monitor_thread.start()
    
    def stop_monitoring(self):
        """停止监控"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join()
    
    def _monitor_resources(self):
        """监控资源使用情况"""
        last_io_counters = self.process.io_counters()
        
        while self.monitoring:
            try:
                # CPU 使用率
                cpu_percent = self.process.cpu_percent(interval=0.1)
                self.metrics['cpu_usage'].append(cpu_percent)
                
                # 内存使用
                memory_info = self.process.memory_info()
                memory_mb = memory_info.rss / 1024 / 1024
                self.metrics['memory_usage'].append(memory_mb)
                
                # 磁盘I/O
                current_io_counters = self.process.io_counters()
                if last_io_counters:
                    read_bytes = current_io_counters.read_bytes - last_io_counters.read_bytes
                    write_bytes = current_io_counters.write_bytes - last_io_counters.write_bytes
                    self.metrics['disk_io_read'] += read_bytes / 1024 / 1024  # MB
                    self.metrics['disk_io_write'] += write_bytes / 1024 / 1024  # MB
                    last_io_counters = current_io_counters
                
                time.sleep(0.5)
            except Exception as e:
                print(f"资源监控错误: {e}")
                break
    
    def get_metrics(self) -> Dict[str, Any]:
        """获取监控指标"""
        return {
            'peak_memory': max(self.metrics['memory_usage']) if self.metrics['memory_usage'] else 0,
            'avg_cpu': sum(self.metrics['cpu_usage']) / len(self.metrics['cpu_usage']) if self.metrics['cpu_usage'] else 0,
            'disk_io_read': self.metrics['disk_io_read'],
            'disk_io_write': self.metrics['disk_io_write']
        }


class BenchmarkRunner:
    """基准测试运行器"""
    
    def __init__(self, config: Optional[BenchmarkConfig] = None):
        self.config = config or self._get_default_config()
        self.results: List[BenchmarkMetrics] = []
        self.test_data_dir = Path(self.config.test_data_dir)
        self.output_dir = Path(self.config.output_dir)
        
        # 确保输出目录存在
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 初始化资源监控器
        self.resource_monitor = ResourceMonitor()
    
    def _get_default_config(self) -> BenchmarkConfig:
        """获取默认配置"""
        return BenchmarkConfig(
            test_data_dir=os.path.join(os.path.dirname(__file__), 'fixtures'),
            output_dir=os.path.join(os.path.dirname(__file__), 'results'),
            scales=['small', 'medium', 'large', 'xlarge'],
            iterations=3,
            timeout=300,
            enable_profiling=True,
            enable_memory_profiling=True
        )
    
    def _get_test_files_for_scale(self, scale: str) -> List[Path]:
        """获取指定规模的测试文件"""
        scale_dirs = {
            'small': 'small_scale',
            'medium': 'medium_scale', 
            'large': 'large_scale',
            'xlarge': 'xlarge_scale'
        }
        
        scale_dir = self.test_data_dir / scale_dirs.get(scale, 'small_scale')
        if not scale_dir.exists():
            raise FileNotFoundError(f"测试数据目录不存在: {scale_dir}")
        
        # 递归查找所有 Python 文件
        python_files = list(scale_dir.rglob('*.py'))
        return python_files
    
    def _analyze_file(self, file_path: Path) -> Dict[str, Any]:
        """分析单个文件"""
        try:
            start_time = time.time()
            
            # 使用 DeadCodeVisitor 分析文件
            visitor = DeadCodeVisitor()
            visitor.analyze(str(file_path))
            
            end_time = time.time()
            
            return {
                'execution_time': end_time - start_time,
                'dead_code_count': len(visitor.get_dead_code()),
                'total_nodes': len(visitor.get_all_nodes()),
                'total_edges': len(visitor.get_edges())
            }
        except Exception as e:
            print(f"分析文件 {file_path} 时出错: {e}")
            return {
                'execution_time': 0,
                'dead_code_count': 0,
                'total_nodes': 0,
                'total_edges': 0,
                'error': str(e)
            }
    
    def run_scale_benchmark(self, scale: str) -> List[BenchmarkMetrics]:
        """运行指定规模的基准测试"""
        print(f"开始 {scale} 规模基准测试...")
        
        scale_results = []
        test_files = self._get_test_files_for_scale(scale)
        
        if not test_files:
            print(f"未找到 {scale} 规模的测试文件")
            return scale_results
        
        print(f"找到 {len(test_files)} 个测试文件")
        
        # 运行多次迭代以获得稳定结果
        for iteration in range(self.config.iterations):
            print(f"  迭代 {iteration + 1}/{self.config.iterations}")
            
            # 开始资源监控
            self.resource_monitor.start_monitoring()
            
            try:
                total_execution_time = 0
                total_dead_code = 0
                total_lines = 0
                
                # 使用线程池并行处理文件
                with ThreadPoolExecutor(max_workers=4) as executor:
                    future_to_file = {
                        executor.submit(self._analyze_file, file): file 
                        for file in test_files
                    }
                    
                    for future in as_completed(future_to_file):
                        file = future_to_file[future]
                        try:
                            result = future.result()
                            total_execution_time += result['execution_time']
                            total_dead_code += result['dead_code_count']
                            
                            # 计算文件行数
                            try:
                                with open(file, 'r', encoding='utf-8') as f:
                                    lines = len(f.readlines())
                                total_lines += lines
                            except:
                                pass
                                
                        except Exception as e:
                            print(f"处理文件 {file} 时出错: {e}")
                
                # 停止资源监控
                self.resource_monitor.stop_monitoring()
                
                # 获取监控指标
                monitor_metrics = self.resource_monitor.get_metrics()
                
                # 创建基准测试指标
                metrics = BenchmarkMetrics(
                    scale=scale,
                    execution_time=total_execution_time,
                    peak_memory_usage=monitor_metrics['peak_memory'],
                    average_cpu_usage=monitor_metrics['avg_cpu'],
                    total_files_processed=len(test_files),
                    total_lines_analyzed=total_lines,
                    dead_code_count=total_dead_code,
                    timestamp=datetime.now().isoformat(),
                    disk_io_read=monitor_metrics['disk_io_read'],
                    disk_io_write=monitor_metrics['disk_io_write']
                )
                
                scale_results.append(metrics)
                print(f"  迭代完成: 执行时间={total_execution_time:.2f}s, 死代码={total_dead_code}")
                
            except Exception as e:
                print(f"基准测试迭代失败: {e}")
                self.resource_monitor.stop_monitoring()
        
        self.results.extend(scale_results)
        return scale_results
    
    def run_full_benchmark(self) -> List[BenchmarkMetrics]:
        """运行完整基准测试"""
        print("开始完整基准测试...")
        
        for scale in self.config.scales:
            self.run_scale_benchmark(scale)
        
        print("完整基准测试完成")
        return self.results
    
    def generate_report(self) -> str:
        """生成性能报告"""
        report_path = self.output_dir / f"benchmark_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        # 计算汇总统计
        summary = self._calculate_summary()
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'config': asdict(self.config),
            'summary': summary,
            'detailed_results': [asdict(result) for result in self.results]
        }
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"性能报告已生成: {report_path}")
        return str(report_path)
    
    def _calculate_summary(self) -> Dict[str, Any]:
        """计算汇总统计"""
        summary = {}
        
        for scale in self.config.scales:
            scale_results = [r for r in self.results if r.scale == scale]
            if not scale_results:
                continue
            
            scale_summary = {
                'avg_execution_time': sum(r.execution_time for r in scale_results) / len(scale_results),
                'avg_peak_memory': sum(r.peak_memory_usage for r in scale_results) / len(scale_results),
                'avg_cpu_usage': sum(r.average_cpu_usage for r in scale_results) / len(scale_results),
                'avg_dead_code_count': sum(r.dead_code_count for r in scale_results) / len(scale_results),
                'total_files_processed': sum(r.total_files_processed for r in scale_results),
                'total_lines_analyzed': sum(r.total_lines_analyzed for r in scale_results),
                'iterations': len(scale_results)
            }
            summary[scale] = scale_summary
        
        return summary
    
    def save_results(self, filename: str = None):
        """保存测试结果"""
        if filename is None:
            filename = f"benchmark_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        results_path = self.output_dir / filename
        
        with open(results_path, 'w', encoding='utf-8') as f:
            json.dump([asdict(result) for result in self.results], f, indent=2, ensure_ascii=False)
        
        print(f"测试结果已保存: {results_path}")
        return str(results_path)


def create_test_data_directories():
    """创建测试数据目录结构"""
    base_dir = Path(__file__).parent / 'fixtures'
    
    scales = {
        'small_scale': 'small_scale',
        'medium_scale': 'medium_scale', 
        'large_scale': 'large_scale',
        'xlarge_scale': 'xlarge_scale'
    }
    
    for scale_name in scales.values():
        scale_dir = base_dir / scale_name
        scale_dir.mkdir(parents=True, exist_ok=True)
        print(f"创建测试数据目录: {scale_dir}")


if __name__ == "__main__":
    # 创建测试数据目录
    create_test_data_directories()
    
    # 运行基准测试
    runner = BenchmarkRunner()
    runner.run_full_benchmark()
    
    # 生成报告
    runner.generate_report()
    
    print("基准测试完成！")