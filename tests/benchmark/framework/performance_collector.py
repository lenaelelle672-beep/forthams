@@ create performance collector module
import time
import psutil
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from contextlib import contextmanager
import json
import logging

@dataclass
class PerformanceMetrics:
    """性能指标数据类"""
    execution_time: float
    memory_usage_mb: float
    cpu_usage_percent: float
    disk_io_bytes: int
    timestamp: float
    test_case_name: str
    code_size_lines: int
    dead_code_count: int

class PerformanceCollector:
    """性能数据收集器"""
    
    def __init__(self, log_file: str = "performance_benchmark.log"):
        self.log_file = log_file
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.INFO)
        
        # 创建文件处理器
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.INFO)
        
        # 创建格式化器
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(formatter)
        
        # 添加处理器到logger
        if not self.logger.handlers:
            self.logger.addHandler(file_handler)
    
    @contextmanager
    def measure_performance(self, test_case_name: str, code_size_lines: int):
        """性能测量上下文管理器"""
        # 初始化指标
        start_time = time.time()
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        initial_cpu = process.cpu_percent()
        
        # 记录开始状态
        self.logger.info(f"开始性能测试: {test_case_name}")
        
        try:
            yield
        finally:
            # 计算最终指标
            end_time = time.time()
            execution_time = end_time - start_time
            
            final_memory = process.memory_info().rss / 1024 / 1024  # MB
            final_cpu = process.cpu_percent()
            
            memory_usage = final_memory - initial_memory
            cpu_usage = final_cpu - initial_cpu
            
            # 获取磁盘I/O
            disk_io = process.io_counters().write_bytes if process.io_counters() else 0
            
            # 创建性能指标对象
            metrics = PerformanceMetrics(
                execution_time=execution_time,
                memory_usage_mb=memory_usage,
                cpu_usage_percent=cpu_usage,
                disk_io_bytes=disk_io,
                timestamp=end_time,
                test_case_name=test_case_name,
                code_size_lines=code_size_lines,
                dead_code_count=0  # 将在分析完成后更新
            )
            
            # 记录性能数据
            self._log_performance_metrics(metrics)
    
    def _log_performance_metrics(self, metrics: PerformanceMetrics):
        """记录性能指标到日志文件"""
        log_entry = {
            "test_case": metrics.test_case_name,
            "execution_time": metrics.execution_time,
            "memory_usage_mb": metrics.memory_usage_mb,
            "cpu_usage_percent": metrics.cpu_usage_percent,
            "disk_io_bytes": metrics.disk_io_bytes,
            "timestamp": metrics.timestamp,
            "code_size_lines": metrics.code_size_lines,
            "dead_code_count": metrics.dead_code_count
        }
        
        self.logger.info(f"性能指标: {json.dumps(log_entry, indent=2)}")
    
    def update_dead_code_count(self, test_case_name: str, dead_code_count: int):
        """更新死代码计数"""
        self.logger.info(f"更新死代码计数 - {test_case_name}: {dead_code_count}")
        # 这里可以添加逻辑来更新特定测试用例的死代码计数
    
    def generate_performance_report(self, output_file: str = "performance_report.json"):
        """生成性能报告"""
        report = {
            "generated_at": time.time(),
            "performance_data": []
        }
        
        # 读取日志文件并解析数据
        try:
            with open(self.log_file, 'r') as f:
                for line in f:
                    if "性能指标:" in line:
                        # 提取JSON数据
                        json_start = line.find("{")
                        if json_start != -1:
                            json_data = line[json_start:]
                            try:
                                metrics = json.loads(json_data)
                                report["performance_data"].append(metrics)
                            except json.JSONDecodeError:
                                continue
        except FileNotFoundError:
            self.logger.warning(f"日志文件 {self.log_file} 不存在")
        
        # 写入报告文件
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        self.logger.info(f"性能报告已生成: {output_file}")
        return report
    
    def get_average_metrics(self) -> Dict[str, float]:
        """获取平均性能指标"""
        if not os.path.exists(self.log_file):
            return {}
        
        total_time = 0
        total_memory = 0
        total_cpu = 0
        count = 0
        
        try:
            with open(self.log_file, 'r') as f:
                for line in f:
                    if "性能指标:" in line:
                        json_start = line.find("{")
                        if json_start != -1:
                            json_data = line[json_start:]
                            try:
                                metrics = json.loads(json_data)
                                total_time += metrics.get("execution_time", 0)
                                total_memory += metrics.get("memory_usage_mb", 0)
                                total_cpu += metrics.get("cpu_usage_percent", 0)
                                count += 1
                            except json.JSONDecodeError:
                                continue
        except FileNotFoundError:
            return {}
        
        if count == 0:
            return {}
        
        return {
            "avg_execution_time": total_time / count,
            "avg_memory_usage_mb": total_memory / count,
            "avg_cpu_usage_percent": total_cpu / count,
            "total_tests": count
        }