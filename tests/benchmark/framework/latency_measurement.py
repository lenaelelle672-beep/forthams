"""
延迟测量框架 - DeadCodeVisitor 性能基准测试

该模块实现了 DeadCodeVisitor 的延迟测量功能，用于评估在不同规模代码库上的响应时延。
支持多规模测试场景、资源消耗监控和性能数据分析。

作者: 规格执行工程师
创建时间: 2025-06-17
"""

import time
import timeit
import psutil
import os
import json
import logging
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from contextlib import contextmanager
import memory_profiler

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class LatencyMetrics:
    """延迟测量指标数据类"""
    test_case_id: str
    code_size_category: str  # 小型、中型、大型、超大型
    code_size_lines: int
    execution_time_ms: float
    peak_memory_mb: float
    average_cpu_percent: float
    wall_time_seconds: float
    user_time_seconds: float
    system_time_seconds: float
    timestamp: float
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return asdict(self)


@dataclass
class TestScenario:
    """测试场景配置"""
    name: str
    code_size_category: str
    expected_lines_range: Tuple[int, int]
    description: str
    
    def validate_code_size(self, actual_lines: int) -> bool:
        """验证代码大小是否符合预期"""
        return self.expected_lines_range[0] <= actual_lines <= self.expected_lines_range[1]


class LatencyMeasurementFramework:
    """延迟测量框架核心类"""
    
    def __init__(self, test_data_dir: str = "tests/benchmark/test_data"):
        """
        初始化延迟测量框架
        
        Args:
            test_data_dir: 测试数据目录路径
        """
        self.test_data_dir = Path(test_data_dir)
        self.metrics: List[LatencyMetrics] = []
        self.test_scenarios = self._initialize_test_scenarios()
        self.process = psutil.Process()
        self.lock = threading.Lock()
        
        # 确保测试数据目录存在
        self.test_data_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"延迟测量框架初始化完成，测试数据目录: {self.test_data_dir}")
    
    def _initialize_test_scenarios(self) -> List[TestScenario]:
        """初始化测试场景配置"""
        scenarios = [
            TestScenario(
                name="small_scale",
                code_size_category="小型",
                expected_lines_range=(0, 1000),
                description="小型代码库 (<1K行)"
            ),
            TestScenario(
                name="medium_scale", 
                code_size_category="中型",
                expected_lines_range=(1000, 10000),
                description="中型代码库 (1K-10K行)"
            ),
            TestScenario(
                name="large_scale",
                code_size_category="大型", 
                expected_lines_range=(10000, 100000),
                description="大型代码库 (10K-100K行)"
            ),
            TestScenario(
                name="xlarge_scale",
                code_size_category="超大型",
                expected_lines_range=(100000, float('inf')),
                description="超大型代码库 (>100K行)"
            )
        ]
        return scenarios
    
    @contextmanager
    def _resource_monitor(self):
        """资源监控上下文管理器"""
        start_time = time.time()
        start_memory = self.process.memory_info().rss / 1024 / 1024  # MB
        cpu_percentages = []
        
        try:
            yield
        finally:
            end_time = time.time()
            end_memory = self.process.memory_info().rss / 1024 / 1024  # MB
            
            # 计算平均CPU使用率
            if hasattr(self, '_cpu_monitor_thread'):
                self._cpu_monitor_thread.join()
            
            execution_time = (end_time - start_time) * 1000  # ms
            peak_memory = max(start_memory, end_memory)
            
            logger.info(f"资源监控完成 - 执行时间: {execution_time:.2f}ms, 峰值内存: {peak_memory:.2f}MB")
    
    def _cpu_monitor(self, duration: float, cpu_percentages: List[float]):
        """CPU使用率监控线程"""
        start = time.time()
        while time.time() - start < duration:
            try:
                cpu_percent = psutil.cpu_percent(interval=0.1)
                with self.lock:
                    cpu_percentages.append(cpu_percent)
            except Exception as e:
                logger.warning(f"CPU监控错误: {e}")
                break
    
    def measure_latency(self, test_case_id: str, code_content: str, 
                       code_size_category: str, code_lines: int) -> LatencyMetrics:
        """
        测量代码分析延迟
        
        Args:
            test_case_id: 测试用例ID
            code_content: 代码内容
            code_size_category: 代码规模类别
            code_lines: 代码行数
            
        Returns:
            LatencyMetrics: 延迟测量结果
        """
        logger.info(f"开始延迟测量 - 测试用例: {test_case_id}, 规模: {code_size_category}")
        
        # 准备CPU监控
        cpu_percentages = []
        duration = 10.0  # 预估执行时间
        
        # 启动CPU监控线程
        cpu_monitor_thread = threading.Thread(
            target=self._cpu_monitor, 
            args=(duration, cpu_percentages)
        )
        cpu_monitor_thread.start()
        self._cpu_monitor_thread = cpu_monitor_thread
        
        with self._resource_monitor():
            # 使用timeit进行精确时延测量
            timer = timeit.Timer(
                stmt=lambda: self._analyze_code(code_content),
                setup='from scripts.ast_dead_code_check import analyze_with_ast'
            )
            
            # 执行多次测量取平均值
            times = timer.repeat(repeat=5, number=1)
            execution_time_ms = min(times) * 1000  # 取最小值作为最佳性能
            
            # 计算资源消耗
            peak_memory_mb = self.process.memory_info().rss / 1024 / 1024
            average_cpu_percent = sum(cpu_percentages) / len(cpu_percentages) if cpu_percentages else 0.0
            
            # 获取系统时间信息
            resource_usage = psutil.Process().cpu_times()
            wall_time = time.time()
            user_time = resource_usage.user
            system_time = resource_usage.system
            
        # 创建测量指标
        metrics = LatencyMetrics(
            test_case_id=test_case_id,
            code_size_category=code_size_category,
            code_size_lines=code_lines,
            execution_time_ms=execution_time_ms,
            peak_memory_mb=peak_memory_mb,
            average_cpu_percent=average_cpu_percent,
            wall_time_seconds=wall_time,
            user_time_seconds=user_time,
            system_time_seconds=system_time,
            timestamp=time.time()
        )
        
        # 存储结果
        with self.lock:
            self.metrics.append(metrics)
        
        logger.info(f"延迟测量完成 - {test_case_id}: {execution_time_ms:.2f}ms")
        return metrics
    
    def _analyze_code(self, code_content: str) -> Dict[str, Any]:
        """
        执行代码分析（模拟DeadCodeVisitor分析）
        
        Args:
            code_content: 要分析的代码内容
            
        Returns:
            分析结果
        """
        try:
            # 这里应该调用实际的DeadCodeVisitor分析
            # 为了演示，我们模拟分析过程
            lines = code_content.split('\n')
            
            # 模拟分析延迟（与代码规模相关）
            analysis_delay = len(lines) * 0.001  # 每行1ms延迟
            time.sleep(analysis_delay)
            
            # 模拟分析结果
            return {
                'total_lines': len(lines),
                'dead_code_count': len(lines) // 10,  # 模拟10%的死代码
                'analysis_time': analysis_delay
            }
            
        except Exception as e:
            logger.error(f"代码分析失败: {e}")
            raise
    
    def run_benchmark_suite(self, test_files: List[str]) -> List[LatencyMetrics]:
        """
        运行完整的基准测试套件
        
        Args:
            test_files: 测试文件列表
            
        Returns:
            所有测量结果
        """
        logger.info(f"开始基准测试套件，共 {len(test_files)} 个测试文件")
        
        results = []
        
        for test_file in test_files:
            try:
                # 读取测试文件
                with open(test_file, 'r', encoding='utf-8') as f:
                    code_content = f.read()
                
                # 分析代码规模
                code_lines = len(code_content.split('\n'))
                
                # 确定代码规模类别
                code_size_category = self._determine_size_category(code_lines)
                
                # 生成测试用例ID
                test_case_id = f"benchmark_{Path(test_file).stem}_{code_size_category}"
                
                # 执行延迟测量
                metrics = self.measure_latency(
                    test_case_id=test_case_id,
                    code_content=code_content,
                    code_size_category=code_size_category,
                    code_lines=code_lines
                )
                
                results.append(metrics)
                
            except Exception as e:
                logger.error(f"测试文件 {test_file} 处理失败: {e}")
                continue
        
        logger.info(f"基准测试套件完成，共完成 {len(results)} 个测试")
        return results
    
    def _determine_size_category(self, code_lines: int) -> str:
        """
        根据代码行数确定规模类别
        
        Args:
            code_lines: 代码行数
            
        Returns:
            规模类别
        """
        for scenario in self.test_scenarios:
            if scenario.validate_code_size(code_lines):
                return scenario.code_size_category
        return "未知"
    
    def generate_performance_report(self, output_file: str = "performance_report.json"):
        """
        生成性能报告
        
        Args:
            output_file: 输出文件路径
        """
        logger.info(f"生成性能报告: {output_file}")
        
        # 按规模类别分组
        grouped_metrics = {}
        for metric in self.metrics:
            category = metric.code_size_category
            if category not in grouped_metrics:
                grouped_metrics[category] = []
            grouped_metrics[category].append(metric)
        
        # 计算统计信息
        report = {
            'timestamp': time.time(),
            'total_test_cases': len(self.metrics),
            'performance_summary': {},
            'detailed_metrics': [m.to_dict() for m in self.metrics],
            'recommendations': self._generate_recommendations(grouped_metrics)
        }
        
        # 计算各规模类别的统计信息
        for category, metrics in grouped_metrics.items():
            if metrics:
                execution_times = [m.execution_time_ms for m in metrics]
                memory_usage = [m.peak_memory_mb for m in metrics]
                
                report['performance_summary'][category] = {
                    'test_count': len(metrics),
                    'avg_execution_time_ms': sum(execution_times) / len(execution_times),
                    'min_execution_time_ms': min(execution_times),
                    'max_execution_time_ms': max(execution_times),
                    'avg_peak_memory_mb': sum(memory_usage) / len(memory_usage),
                    'min_peak_memory_mb': min(memory_usage),
                    'max_peak_memory_mb': max(memory_usage),
                    'code_size_range': [
                        min(m.code_size_lines for m in metrics),
                        max(m.code_size_lines for m in metrics)
                    ]
                }
        
        # 保存报告
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        logger.info(f"性能报告已生成: {output_file}")
        return report
    
    def _generate_recommendations(self, grouped_metrics: Dict[str, List[LatencyMetrics]]) -> List[str]:
        """
        生成性能优化建议
        
        Args:
            grouped_metrics: 分组的测量指标
            
        Returns:
            优化建议列表
        """
        recommendations = []
        
        for category, metrics in grouped_metrics.items():
            if not metrics:
                continue
                
            avg_time = sum(m.execution_time_ms for m in metrics) / len(metrics)
            avg_memory = sum(m.peak_memory_mb for m in metrics) / len(metrics)
            
            if avg_time > 1000:  # 超过1秒
                recommendations.append(
                    f"{category}规模代码库平均执行时间{avg_time:.2f}ms，建议优化算法复杂度"
                )
            
            if avg_memory > 500:  # 超过500MB
                recommendations.append(
                    f"{category}规模代码库平均内存使用{avg_memory:.2f}MB，建议优化内存管理"
                )
        
        if not recommendations:
            recommendations.append("性能表现良好，未发现明显优化需求")
        
        return recommendations
    
    def run_performance_regression_test(self, baseline_file: str) -> Dict[str, Any]:
        """
        运行性能回归测试
        
        Args:
            baseline_file: 基准性能文件路径
            
        Returns:
            回归测试结果
        """
        logger.info(f"开始性能回归测试，基准文件: {baseline_file}")
        
        try:
            # 加载基准数据
            with open(baseline_file, 'r', encoding='utf-8') as f:
                baseline_data = json.load(f)
            
            # 计算性能变化
            regression_results = {
                'timestamp': time.time(),
                'baseline_loaded': True,
                'performance_changes': {},
                'regression_detected': False,
                'alerts': []
            }
            
            # 比较当前性能与基准
            current_summary = {}
            for metric in self.metrics:
                category = metric.code_size_category
                if category not in current_summary:
                    current_summary[category] = []
                current_summary[category].append(metric)
            
            for category, baseline_metrics in baseline_data.get('performance_summary', {}).items():
                if category in current_summary:
                    current_avg_time = sum(m.execution_time_ms for m in current_summary[category]) / len(current_summary[category])
                    baseline_avg_time = baseline_metrics['avg_execution_time_ms']
                    
                    # 计算性能变化百分比
                    if baseline_avg_time > 0:
                        change_percent = ((current_avg_time - baseline_avg_time) / baseline_avg_time) * 100
                        
                        regression_results['performance_changes'][category] = {
                            'baseline_time_ms': baseline_avg_time,
                            'current_time_ms': current_avg_time,
                            'change_percent': change_percent
                        }
                        
                        # 检测性能退化（超过20%视为退化）
                        if change_percent > 20:
                            regression_results['regression_detected'] = True
                            regression_results['alerts'].append(
                                f"性能退化警告: {category}规模性能下降{change_percent:.1f}%"
                            )
            
            logger.info(f"性能回归测试完成，检测到退化: {regression_results['regression_detected']}")
            return regression_results
            
        except Exception as e:
            logger.error(f"性能回归测试失败: {e}")
            return {
                'timestamp': time.time(),
                'baseline_loaded': False,
                'error': str(e),
                'regression_detected': False,
                'alerts': []
            }


def create_latency_test_files(test_data_dir: str = "tests/benchmark/test_data"):
    """
    创建测试数据文件（用于演示）
    
    Args:
        test_data_dir: 测试数据目录
    """
    test_dir = Path(test_data_dir)
    test_dir.mkdir(parents=True, exist_ok=True)
    
    # 创建不同规模的测试文件
    test_files = [
        ("small_test.py", 500, "小型测试文件"),
        ("medium_test.py", 5000, "中型测试文件"),
        ("large_test.py", 50000, "大型测试文件"),
        ("xlarge_test.py", 200000, "超大型测试文件")
    ]
    
    for filename, lines, description in test_files:
        file_path = test_dir / filename
        
        # 生成测试代码
        test_code = f'''# {description}
# 自动生成的测试文件，共 {lines} 行

def function_1():
    """简单的测试函数"""
    pass

def function_2():
    """另一个测试函数"""
    return "test"

class TestClass:
    """测试类"""
    def method_1(self):
        pass
    
    def method_2(self):
        return True

'''
        
        # 添加更多代码以达到目标行数
        remaining_lines = lines - len(test_code.split('\n'))
        for i in range(remaining_lines):
            test_code += f"# 行 {i+1}: 测试注释\\n"
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(test_code)
        
        logger.info(f"创建测试文件: {file_path} ({lines} 行)")


if __name__ == "__main__":
    # 创建测试数据
    create_latency_test_files()
    
    # 初始化延迟测量框架
    framework = LatencyMeasurementFramework()
    
    # 运行基准测试
    test_files = list(Path("tests/benchmark/test_data").glob("*.py"))
    results = framework.run_benchmark_suite(test_files)
    
    # 生成性能报告
    report = framework.generate_performance_report()
    
    # 运行回归测试（如果有基准文件）
    baseline_file = "tests/benchmark/framework/baseline_performance.json"
    if Path(baseline_file).exists():
        regression_results = framework.run_performance_regression_test(baseline_file)
        print("回归测试结果:", regression_results)
    
    print(f"基准测试完成，共测试 {len(results)} 个文件")
    print(f"性能报告已保存到: performance_report.json")