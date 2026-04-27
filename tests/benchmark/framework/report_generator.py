"""
DeadCodeVisitor 性能基准测试报告生成器

该模块负责生成标准化的性能测试报告，包括：
- 资源消耗分析（CPU、内存、磁盘I/O）
- 响应时延测量结果
- 性能趋势可视化
- 优化建议生成

对应 SPEC Phase 3: 性能优化与基准测试阶段
"""

import json
import time
import psutil
import matplotlib.pyplot as plt
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import logging
from memory_profiler import memory_usage
import numpy as np


@dataclass
class PerformanceMetrics:
    """性能指标数据结构"""
    test_name: str
    code_size: int  # 代码行数
    execution_time: float  # 执行时间（秒）
    peak_memory_usage: float  # 峰值内存使用（MB）
    average_cpu_usage: float  # 平均CPU使用率（%）
    dead_code_count: int  # 检测到的死代码数量
    timestamp: datetime  # 测试时间戳
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


class PerformanceReportGenerator:
    """性能报告生成器"""
    
    def __init__(self, output_dir: str = "benchmark_reports"):
        """
        初始化报告生成器
        
        Args:
            output_dir: 报告输出目录
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # 设置日志
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # 性能指标历史记录
        self.metrics_history: List[PerformanceMetrics] = []
        
        # 测试环境信息
        self.environment_info = self._collect_environment_info()
    
    def _collect_environment_info(self) -> Dict[str, Any]:
        """收集测试环境信息"""
        return {
            "cpu_count": psutil.cpu_count(),
            "cpu_freq": psutil.cpu_freq().current if psutil.cpu_freq() else None,
            "total_memory": psutil.virtual_memory().total / (1024**3),  # GB
            "python_version": f"{time.strftime('%Y-%m-%d %H:%M:%S')}",
            "platform": psutil.platform(),
            "benchmark_timestamp": datetime.now().isoformat()
        }
    
    def run_performance_test(self, test_name: str, code_files: List[str], 
                           dead_code_visitor_class) -> PerformanceMetrics:
        """
        运行性能测试
        
        Args:
            test_name: 测试名称
            code_files: 待分析的代码文件列表
            dead_code_visitor_class: DeadCodeVisitor类实例
            
        Returns:
            PerformanceMetrics: 性能指标数据
        """
        self.logger.info(f"开始性能测试: {test_name}")
        
        # 计算代码规模
        total_lines = self._calculate_code_size(code_files)
        
        # 监控系统资源
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # 执行死代码分析
        start_time = time.time()
        
        try:
            # 使用memory_profiler监控内存使用
            mem_usage = memory_usage(
                (dead_code_visitor_class.analyze, (code_files,)),
                interval=0.1,
                timeout=None
            )
            
            execution_time = time.time() - start_time
            peak_memory = max(mem_usage) if mem_usage else initial_memory
            average_cpu = psutil.cpu_percent(interval=1)
            
            # 获取死代码统计
            dead_code_count = len(dead_code_visitor_class.get_dead_code())
            
            # 创建性能指标对象
            metrics = PerformanceMetrics(
                test_name=test_name,
                code_size=total_lines,
                execution_time=execution_time,
                peak_memory_usage=peak_memory,
                average_cpu_usage=average_cpu,
                dead_code_count=dead_code_count,
                timestamp=datetime.now()
            )
            
            self.metrics_history.append(metrics)
            self.logger.info(f"性能测试完成: {test_name}")
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"性能测试失败: {test_name}, 错误: {str(e)}")
            raise
    
    def _calculate_code_size(self, code_files: List[str]) -> int:
        """计算代码总行数"""
        total_lines = 0
        for file_path in code_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    total_lines += len(f.readlines())
            except Exception as e:
                self.logger.warning(f"无法读取文件 {file_path}: {str(e)}")
        return total_lines
    
    def generate_performance_report(self, test_name: str) -> str:
        """
        生成性能报告
        
        Args:
            test_name: 测试名称
            
        Returns:
            str: 报告文件路径
        """
        # 获取指定测试的指标
        test_metrics = [m for m in self.metrics_history if m.test_name == test_name]
        if not test_metrics:
            raise ValueError(f"未找到测试 '{test_name}' 的性能数据")
        
        # 生成报告内容
        report_data = {
            "test_info": {
                "name": test_name,
                "timestamp": datetime.now().isoformat(),
                "environment": self.environment_info
            },
            "performance_metrics": [m.to_dict() for m in test_metrics],
            "analysis": self._analyze_performance_trends(test_metrics),
            "recommendations": self._generate_recommendations(test_metrics)
        }
        
        # 保存报告
        report_file = self.output_dir / f"performance_report_{test_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        # 生成可视化图表
        self._generate_visualization(test_metrics, test_name)
        
        self.logger.info(f"性能报告已生成: {report_file}")
        return str(report_file)
    
    def _analyze_performance_trends(self, metrics: List[PerformanceMetrics]) -> Dict[str, Any]:
        """分析性能趋势"""
        if len(metrics) < 2:
            return {"trend": "insufficient_data"}
        
        # 计算性能指标的相关性
        code_sizes = [m.code_size for m in metrics]
        execution_times = [m.execution_time for m in metrics]
        memory_usages = [m.peak_memory_usage for m in metrics]
        
        # 计算时间复杂度趋势
        time_correlation = np.corrcoef(code_sizes, execution_times)[0, 1] if len(code_sizes) > 1 else 0
        memory_correlation = np.corrcoef(code_sizes, memory_usages)[0, 1] if len(code_sizes) > 1 else 0
        
        return {
            "time_complexity_trend": "linear" if abs(time_correlation) > 0.8 else "sublinear",
            "memory_complexity_trend": "linear" if abs(memory_correlation) > 0.8 else "sublinear",
            "correlation_coefficients": {
                "time_vs_size": time_correlation,
                "memory_vs_size": memory_correlation
            },
            "performance_summary": {
                "avg_execution_time": np.mean(execution_times),
                "avg_memory_usage": np.mean(memory_usages),
                "max_execution_time": max(execution_times),
                "max_memory_usage": max(memory_usages)
            }
        }
    
    def _generate_recommendations(self, metrics: List[PerformanceMetrics]) -> List[str]:
        """生成优化建议"""
        recommendations = []
        
        if not metrics:
            return recommendations
        
        # 分析内存使用
        avg_memory = np.mean([m.peak_memory_usage for m in metrics])
        if avg_memory > 500:  # MB
            recommendations.append("考虑优化内存使用，可能存在内存泄漏")
        
        # 分析执行时间
        avg_time = np.mean([m.execution_time for m in metrics])
        if avg_time > 10:  # 秒
            recommendations.append("执行时间较长，考虑优化算法或增加缓存")
        
        # 分析CPU使用率
        avg_cpu = np.mean([m.average_cpu_usage for m in metrics])
        if avg_cpu > 80:  # %
            recommendations.append("CPU使用率过高，考虑并行化处理")
        
        # 检查性能退化
        if len(metrics) >= 3:
            recent_times = [m.execution_time for m in metrics[-3:]]
            if recent_times[-1] > recent_times[0] * 1.5:
                recommendations.append("检测到性能退化，建议检查最近的代码变更")
        
        return recommendations
    
    def _generate_visualization(self, metrics: List[PerformanceMetrics], test_name: str):
        """生成性能可视化图表"""
        if not metrics:
            return
        
        # 创建图表
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle(f'性能测试报告 - {test_name}', fontsize=16)
        
        # 1. 执行时间 vs 代码规模
        code_sizes = [m.code_size for m in metrics]
        execution_times = [m.execution_time for m in metrics]
        ax1.scatter(code_sizes, execution_times, alpha=0.6)
        ax1.set_xlabel('代码行数')
        ax1.set_ylabel('执行时间 (秒)')
        ax1.set_title('执行时间 vs 代码规模')
        ax1.grid(True)
        
        # 2. 内存使用 vs 代码规模
        memory_usages = [m.peak_memory_usage for m in metrics]
        ax2.scatter(code_sizes, memory_usages, alpha=0.6, color='orange')
        ax2.set_xlabel('代码行数')
        ax2.set_ylabel('内存使用 (MB)')
        ax2.set_title('内存使用 vs 代码规模')
        ax2.grid(True)
        
        # 3. 死代码数量趋势
        dead_code_counts = [m.dead_code_count for m in metrics]
        ax3.plot(range(len(metrics)), dead_code_counts, marker='o')
        ax3.set_xlabel('测试次数')
        ax3.set_ylabel('死代码数量')
        ax3.set_title('死代码检测趋势')
        ax3.grid(True)
        
        # 4. CPU使用率
        cpu_usages = [m.average_cpu_usage for m in metrics]
        ax4.bar(range(len(metrics)), cpu_usages, alpha=0.7, color='green')
        ax4.set_xlabel('测试次数')
        ax4.set_ylabel('CPU使用率 (%)')
        ax4.set_title('CPU使用率')
        ax4.grid(True)
        
        # 保存图表
        chart_file = self.output_dir / f"performance_chart_{test_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        plt.tight_layout()
        plt.savefig(chart_file, dpi=300, bbox_inches='tight')
        plt.close()
        
        self.logger.info(f"性能图表已生成: {chart_file}")
    
    def generate_regression_test_report(self, baseline_metrics: List[PerformanceMetrics], 
                                     current_metrics: List[PerformanceMetrics]) -> str:
        """
        生成性能回归测试报告
        
        Args:
            baseline_metrics: 基线性能指标
            current_metrics: 当前性能指标
            
        Returns:
            str: 报告文件路径
        """
        regression_data = {
            "test_type": "regression_test",
            "timestamp": datetime.now().isoformat(),
            "baseline_metrics": [m.to_dict() for m in baseline_metrics],
            "current_metrics": [m.to_dict() for m in current_metrics],
            "regression_analysis": self._analyze_regression(baseline_metrics, current_metrics),
            "alert_level": self._determine_alert_level(baseline_metrics, current_metrics)
        }
        
        # 保存回归测试报告
        report_file = self.output_dir / f"regression_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(regression_data, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"回归测试报告已生成: {report_file}")
        return str(report_file)
    
    def _analyze_regression(self, baseline: List[PerformanceMetrics], 
                          current: List[PerformanceMetrics]) -> Dict[str, Any]:
        """分析性能回归"""
        if not baseline or not current:
            return {"error": "insufficient_data"}
        
        # 计算性能变化百分比
        baseline_avg_time = np.mean([m.execution_time for m in baseline])
        current_avg_time = np.mean([m.execution_time for m in current])
        
        baseline_avg_memory = np.mean([m.peak_memory_usage for m in baseline])
        current_avg_memory = np.mean([m.peak_memory_usage for m in current])
        
        time_change = ((current_avg_time - baseline_avg_time) / baseline_avg_time) * 100
        memory_change = ((current_avg_memory - baseline_avg_memory) / baseline_avg_memory) * 100
        
        return {
            "execution_time_change_percent": time_change,
            "memory_usage_change_percent": memory_change,
            "regression_detected": abs(time_change) > 20 or abs(memory_change) > 20
        }
    
    def _determine_alert_level(self, baseline: List[PerformanceMetrics], 
                             current: List[PerformanceMetrics]) -> str:
        """确定警报级别"""
        regression_analysis = self._analyze_regression(baseline, current)
        
        if not regression_analysis.get("regression_detected", False):
            return "normal"
        
        time_change = regression_analysis.get("execution_time_change_percent", 0)
        memory_change = regression_analysis.get("memory_usage_change_percent", 0)
        
        if abs(time_change) > 50 or abs(memory_change) > 50:
            return "critical"
        elif abs(time_change) > 30 or abs(memory_change) > 30:
            return "warning"
        else:
            return "minor"


class BenchmarkTestRunner:
    """基准测试运行器"""
    
    def __init__(self, report_generator: PerformanceReportGenerator):
        """
        初始化测试运行器
        
        Args:
            report_generator: 性能报告生成器
        """
        self.report_generator = report_generator
        self.test_scenarios = {
            "small": {"size": "< 1K lines", "expected_range": (0.1, 1.0)},
            "medium": {"size": "1K-10K lines", "expected_range": (1.0, 5.0)},
            "large": {"size": "10K-100K lines", "expected_range": (5.0, 30.0)},
            "xlarge": {"size": "> 100K lines", "expected_range": (30.0, 120.0)}
        }
    
    def run_benchmark_suite(self, test_data_sets: Dict[str, List[str]], 
                          dead_code_visitor_class) -> Dict[str, str]:
        """
        运行完整的基准测试套件
        
        Args:
            test_data_sets: 测试数据集，键为规模类型，值为文件列表
            dead_code_visitor_class: DeadCodeVisitor类实例
            
        Returns:
            Dict[str, str]: 各测试的报告文件路径
        """
        results = {}
        
        for scale_type, code_files in test_data_sets.items():
            test_name = f"benchmark_{scale_type}"
            
            try:
                # 运行性能测试
                metrics = self.report_generator.run_performance_test(
                    test_name, code_files, dead_code_visitor_class
                )
                
                # 生成报告
                report_file = self.report_generator.generate_performance_report(test_name)
                results[scale_type] = report_file
                
                # 验证测试结果
                self._validate_test_results(metrics, scale_type)
                
            except Exception as e:
                self.report_generator.logger.error(f"基准测试失败 {scale_type}: {str(e)}")
                results[scale_type] = f"failed: {str(e)}"
        
        return results
    
    def _validate_test_results(self, metrics: PerformanceMetrics, scale_type: str):
        """验证测试结果是否符合预期"""
        expected_range = self.test_scenarios.get(scale_type, {}).get("expected_range", (0, float('inf')))
        
        execution_time = metrics.execution_time
        
        if execution_time < expected_range[0]:
            self.report_generator.logger.warning(
                f"测试 {scale_type} 执行时间 {execution_time}s 低于预期范围 {expected_range}"
            )
        elif execution_time > expected_range[1]:
            self.report_generator.logger.warning(
                f"测试 {scale_type} 执行时间 {execution_time}s 超出预期范围 {expected_range}"
            )
        else:
            self.report_generator.logger.info(
                f"测试 {scale_type} 执行时间 {execution_time}s 在预期范围内 {expected_range}"
            )